var Transform = require('readable-stream/transform');
var Readable = require('readable-stream/readable');
var combine = require('stream-combiner');

var bytewise = require('bytewise');
var foreignKey = require('foreign-key');
var tracker = require('level-track');

var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

var Type = require('./lib/type.js');
var matches = require('./lib/matches.js');

inherits(Assoc, EventEmitter);

module.exports = Assoc;
function Assoc (db) {
    if (!(this instanceof Assoc)) return new Assoc(db);
    this.db = db;
    this.sublevel = db.sublevel('assoc');
    this._foreign = {};
    this._has = [];
    this._hasKeys = {};
    this._belongs = {};
    
    var self = this;
    db.hooks.post({ start: '', end: '~' }, function (change) {
        if (change.type === 'put') {
            var value = typeof change.value === 'string'
                ? JSON.parse(change.value)
                : change.value
            ;
            self._postPut(change.key, value, function (err) {
                if (err) self.db.emit('error', err)
            });
            self.emit('_put', change.key, value);
        }
        else if (change.type === 'del') {
            // ignore deletes; compaction happens on stream key lookup errors
        }
    });
}

Assoc.prototype.add = function (key) {
    this._foreign[key] = foreignKey([ 'type', key ]);
    this._hasKeys[key] = {};
    
    var self = this;
    return new Type({ hasMany: hasMany, belongsTo: belongsTo });
    
    function hasMany (k, type) {
        self._has.push([ type, k, key ]);
        self._hasKeys[key][k] = type;
        self._foreign[key].add(k, type, key);
    }
    
    function belongsTo (k) {
        self._belongs[key] = k;
    }
};

Assoc.prototype._postPut = function (key, value, cb) {
    if (!value) return cb();
    var self = this;
    
    var pending = 1;
    
    var k = bytewise.encode([ value.type, key ]).toString('hex');
    this.sublevel.put(k, 0, function (err) {
        if (err) cb(err)
        else if (--pending === 0) cb()
    });
    
    for (var i = 0, li = this._has.length; i < li; i++) {
        if (!matches(value, this._has[i][0])) continue;
        
        var topKey = this._has[i][2];
        var fkey = [ null, topKey ]
            .concat(this._foreign[topKey].keyList(key, value))
        ;
        
        pending ++;
        
        var k = bytewise.encode(fkey).toString('hex');
        this.sublevel.put(k, 0, function (err) {
            if (err) cb(err)
            else if (--pending === 0) cb()
        });
        this.emit('_index', k, fkey);
    }
    
    if (pending === 0) cb();
};

Assoc.prototype.get = function (topKey, cb) {
    var self = this;
    if (!cb) cb = function () {};
    var stream, row;
    
    this.db.get(topKey, function (err, r) {
        if (stream && err) stream.emit('error', err)
        if (err) return cb && cb(err);
        row = r;
        self._augment(topKey, row);
        if (stream) stream._setRow(row);
        cb(null, row);
    });
    
    return {
        createStream: function (opts) {
            stream = createRowStream(opts);
            if (row) stream._setRow(row);
            return stream;
        }
    };
};

function createRowStream (row, opts) {
    if (!opts) opts = {};
    
    var rs = new Readable;
    var fkeys, stream, first = true, sfirst;
    
    rs._setRow = function (r) {
        row = r;
        begin();
    };
    
    rs._read = function () {
        if (!fkeys) return;
        if (!stream && fkeys.length === 0) return finish();
        
        if (!stream) {
            var key = fkeys.shift();
            var skey = JSON.stringify(key);
            rs.push((first ? skey : ',' + skey) + ':[');
            first = false;
            stream = (opts.keys ? row.value : row)[key]();
            stream.on('finish', function () {
                stream = null;
                rs.push(']');
            });
            sfirst = true;
        }
        
        var x = stream.read();
        if (x) ready()
        else stream.once('readable', function () {
            x = stream.read();
            if (x) ready();
        });
        
        function ready () {
            var s = JSON.stringify(x);
            var sfirst_ = sfirst;
            sfirst = false;
            rs.push(sfirst_ ? s : ',' + s);
        }
        
        function finish () {
            rs.push(opts.keys ? '}}' : '}');
            return rs.push(null);
        }
    };
    
    if (row) begin();
    return rs;
    
    function begin () {
        var value = opts.keys ? row.value : row;
        fkeys = Object.keys(value).filter(function (key) {
            return typeof value[key] === 'function';
        });
        var s = '{' + Object.keys(value).map(function (key) {
            if (typeof value[key] === 'function') return false;
            first = false;
            return JSON.stringify(key) + ':' + JSON.stringify(value[key]);
        }).filter(Boolean).join(',');
        
        if (opts.keys) {
            s = '{"key":' + JSON.stringify(row.key) + ',"value":' + s;
        }
        rs.push(s);
    }
}

Assoc.prototype._augment = function (key, row, opts, cb) {
    if (typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    if (!opts) opts = {};
    
    var self = this;
    var many = this._hasKeys[row.type];
    if (many) Object.keys(many).forEach(function (k) {
        var type = many[k];
        row[k] = function (cb) {
            var s = self._rowStream(row.type, key, k, opts);
            if (cb) {
                var results = [];
                s.on('error', cb);
                s.on('data', function (r) { results.push(r) });
                s.on('end', function () { cb(null, results) });
            }
            return s;
        };
    });
    var belongs = this._belongs[row.type];
    if (belongs && row[belongs]) {
        self.get(row[belongs], function (err, srow) {
            // TODO
        });
    }
};

Assoc.prototype._rowStream = function (topType, topKey, key, params) {
    if (!params) params = {};
    
    var self = this;
    var start = [ null, topType, topKey, key ];
    var end = [ null, topType, topKey, key, undefined ];
    
    var opts = {
        start: bytewise.encode(start).toString('hex'),
        end: bytewise.encode(end).toString('hex'),
        old: params.old
    };
    
    var tr = new Transform({ objectMode: true });
    tr.startKey = opts.start;
    tr.startKeys = start;
    tr.endKey = opts.end;
    tr.endKeys = end;
    
    tr._transform = function (row, enc, next) {
        var parts = bytewise.decode(Buffer(row.key, 'hex'));
        if (!parts) return next();
        
        self.db.get(parts[4], function (err, value) {
            if ((err && err.name === 'NotFoundError')
            || (value && value[topType] !== topKey)) {
                // lazily remove deleted or stale indexes
                self.sublevel.del(row.key);
                return next();
            }
            else if (err) return next(err);
            
            self._augment(parts[4], value);
            
            if (params.keys === false) tr.push(value)
            else if (params.old === false && row.live !== true) {
                tr.push({ key: parts[4], value: value, _old: true });
            }
            else tr.push({ key: parts[4], value: value });
            
            next();
        });
    };
    
    if (params.follow) {
        return self._createLiveStream(opts).pipe(tr);
    }
    else return self.sublevel.createReadStream(opts).pipe(tr);
};

Assoc.prototype.list = function (type, params, cb) {
    var self = this;
    if (typeof params === 'function') {
        cb = params;
        params = {};
    }
    if (!params) params = {};
    if (params.live !== undefined) params.follow = params.live;
    
    var start = [ type, null ];
    if (params.start !== undefined) {
        start = [ type, params.start ];
    }
    else if (params.gte !== undefined) {
        start = [ type, params.gte ];
    }
    else if (params.gt !== undefined) {
        start = [ type, params.gt, null ];
    }
    
    var end = [ type, params.end ];
    if (params.lte !== undefined) {
        end = [ type, params.lte ];
    }
    else if (params.lt !== undefined) {
        end = [ type, params.lt.replace(/.$/, function (c) {
            return String.fromCharCode(c.charCodeAt(0) - 1) + '\xff';
        }) ];
    }
    
    var opts = {
        start: bytewise.encode(start).toString('hex'),
        end: bytewise.encode(end).toString('hex'),
        old: params.old,
        reverse: params.reverse
    };
    var tr = new Transform({ objectMode: true });
    tr.startKey = opts.start;
    tr.startKeys = start;
    tr.endKey = opts.end;
    tr.endKeys = end;
    var pending = 0, ended = false;
    
    tr._transform = function (row, enc, next) {
        var key = bytewise.decode(Buffer(row.key, 'hex'));
        if (!key) return;
        
        self.db.get(key[1], function (err, value) {
            if ((err && err.name === 'NotFoundError')
            || (value && value.type !== type)) {
                self.sublevel.del(row.key);
                return next();
            }
            else if (err) return next(err);
            
            if (params.augment !== false && !params.flat) {
                self._augment(key[1], value, { keys: params.keys !== false });
            }
            
            if (row._old !== true) {
                if (params.keys === false) tr.push(value)
                else tr.push({ key: key[1], value: value })
            }
            
            if (params.flat) {
                var many = self._hasKeys[value.type];
                var keys = many && Object.keys(many);
                if (!keys || !keys.length) return next();
                pending += keys.length;
                
                keys.forEach(function (k) {
                    var type = many[k];
                    var s = self._rowStream(value.type, key[1], k, {
                        follow: params.follow,
                        old: params.old
                    });
                    s.on('readable', function () {
                        var r = s.read();
                        if (r === null) {
                            if (--pending === 0 && ended && !params.follow) {
                                tr.push(null);
                            }
                        }
                        else if (r._old === true) {}
                        else if (params.keys === false) {
                            tr.push(r.value)
                        }
                        else tr.push(r);
                    });
                });
            }
            next();
        });
    };
    
    tr._flush = function (next) {
        ended = true;
        if (!params.follow && pending === 0) {
            tr.push(null);
            next();
        }
    };
    
    tr.createStream = function (opts) {
        if (!opts) opts = {};
        var stream = new Transform({ objectMode: true });
        if (params.follow && params.autoclose !== false) {
            whenFinished(stream, function () { liveStream.close() });
        }
        
        if (params.flat) {
            stream._transform = function (row, enc, next) {
                this.push(JSON.stringify(row) + '\n');
                next();
            };
            return tr.pipe(stream);
        }
        
        var first = true;
        stream._transform = function (row, enc, next) {
            opts.keys = true;
            var rs = createRowStream(row, opts);
            if (!first) stream.push(',');
            first = false;
            
            rs.on('readable', function () {
                var buf = rs.read();
                if (buf === null) next()
                else stream.push(buf)
            });
        };
        stream._flush = function (next) {
            stream.push(']');
            stream.push(null);
            next();
        };
        
        stream.push('[');
        tr.pipe(stream);
        return stream;
    };
    
    if (cb) {
        var results = [];
        tr.on('error', cb);
        tr.on('data', function (row) { results.push(row) });
        tr.on('end', function () { cb(null, results) });
    }
    
    if (params.meta) {
        tr.push({ type: 'meta', value: self._hasKeys });
    }
    
    var liveStream;
    if (params.follow) {
        liveStream = self._createLiveStream(opts);
        if (params.autoclose === false) {
            return liveStream.pipe(tr);
        }
        else return whenFinished(
            liveStream.pipe(tr),
            function () { liveStream.close() }
        );
    }
    else return self.sublevel.createReadStream(opts).pipe(tr);
};

Assoc.prototype.live = function (name, opts) {
    if (!opts) opts = {};
    opts.flat = true;
    opts.follow = true;
    if (opts.old === undefined) opts.old = false;
    return this.list(name, opts);
};

Assoc.prototype.track = function () {
    var self = this;
    if (!self._tracker) {
        self._tracker = tracker(self.sublevel);
    }
    
    var decode = new Transform({ objectMode: true });
    decode._transform = function (row, enc, next) {
        if (!row || !/^[A-Fa-f0-9]+$/.test(row.key)) {
            return pass();
        }
        
        var parts = bytewise.decode(Buffer(row.key, 'hex'));
        if (!Array.isArray(parts) || parts.length < 5) return pass();
        var key = parts[4];
        
        self.db.get(key, function (err, value) {
            if (err) return pass();
            
            var ref = { key: key, value: value };
            decode.push(JSON.stringify(ref) + '\n');
            next();
        });
        
        function pass () {
            decode.push(JSON.stringify(row) + '\n');
            return next();
        }
    };
    return combine(self._tracker({ objectMode: true }), decode);
};

Assoc.prototype._createLiveStream = function (opts) {
    var self = this;
    var db = self.sublevel;
    
    var tf = new Transform({ objectMode: true });
    tf._transform = function (row, enc, next) {
        if (opts.old === false) row._old = true;
        tf.push(row);
        next();
    };
    
    tf._flush = function (next) {
        if (closed) return next();
        self.on('_index', onindex);
        self.on('_put', onput);
        tf.once('close', next);
    };
    
    var closed = false;
    tf.close = function () {
        if (closed) return;
        closed = true;
        
        self.removeListener('_index', onindex);
        self.removeListener('_put', onput);
        
        tf.push(null);
        tf.emit('close');
    };
    var start = bytewise.decode(Buffer(opts.start, 'hex'));
    
    return db.createReadStream({
        start: opts.start,
        end: opts.end,
        reverse: opts.reverse
    }).pipe(tf);
    
    function onindex (key) {
        if (closed) return;
        if (key >= opts.start && key <= opts.end) {
            tf.push({ key: key, value: 0, live: true });
        }
    }
    
    function onput (key, value) {
        if (value && value.type && value.type === start[0]) {
            var k = bytewise.encode([ value.type, key ]).toString('hex');
            if (k >= opts.start && k <= opts.end) {
                tf.push({ key: k, value: value, live: true });
            }
        }
    }
};

function readable () {
    var rs = new Readable({ objectMode: true });
    rs._read = function () {};
    return rs;
}

function whenFinished (stream, cb) {
    var pipeTargets = 0;
    var prevPipe = stream.pipe;
    stream.pipe = function (dst) {
        pipeTargets ++;
        var closed = false;
        dst.once('unpipe', onclose);
        dst.once('close', onclose);
        return prevPipe.apply(this, arguments);
        
        function onclose () {
            if (closed) return;
            closed = true;
            if (-- pipeTargets === 0) cb();
            stream.pipe = prevPipe;
        }
    };
    return stream;
}
