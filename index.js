var bytewise = require('bytewise');
var Transform = require('readable-stream/transform');
var Readable = require('readable-stream/readable');
var foreignKey = require('foreign-key');
var liveStream = require('level-live-stream');

module.exports = Assoc;
function Assoc (db) {
    if (!(this instanceof Assoc)) return new Assoc(db);
    this.db = db;
    this._sublevel = db.sublevel('assoc');
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
    this._sublevel.put(k, 0, function (err) {
        if (err) cb(err)
        else if (--pending === 0) cb()
    });
    
    for (var i = 0, li = this._has.length; i < li; i++) {
        var ts = this._has[i][0];
        var cur = value;
        for (var cur, j = 0, lj = ts.length - 1; j < lj; j++) {
            cur = cur[ts[j]];
            if (cur === undefined) break;
        }
        if (j !== lj || cur !== ts[j]) continue;
        
        var topKey = this._has[i][2];
        var fkey = [ null, topKey ]
            .concat(this._foreign[topKey].keyList(key, value))
        ;
        
        pending ++;
        
        var k = bytewise.encode(fkey).toString('hex');
        this._sublevel.put(k, 0, function (err) {
            if (err) cb(err)
            else if (--pending === 0) cb()
            
        });
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
            
        });
    }
};

Assoc.prototype._rowStream = function (topType, topKey, key, opts) {
    if (!opts) opts = {};
    
    var self = this;
    var start = [ null, topType, topKey, key ];
    var end = [ null, topType, topKey, key, undefined ];
    
    var opts = {
        start: bytewise.encode(start).toString('hex'),
        end: bytewise.encode(end).toString('hex')
    };
    var tr = new Transform({ objectMode: true });
    tr._transform = function (row, enc, next) {
        var parts = bytewise.decode(Buffer(row.key, 'hex'));
        self.db.get(parts[4], function (err, value) {
            
            if ((err && err.name === 'NotFoundError')
            || (value && value[topType] !== topKey)) {
                // lazily remove deleted or stale indexes
                self._sublevel.del(row.key);
                return next();
            }
            else if (err) return next(err);
            
            self._augment(parts[4], value);
            
            if (opts.keys === false) tr.push(value)
            else tr.push({ key: parts[4], value: value });
            
            next();
        });
    };
    tr._flush = function (next) {
        next();
    };
    return self._sublevel.createReadStream(opts).pipe(tr);
};

Assoc.prototype.list = function (type, params, cb) {
    var self = this;
    if (typeof params === 'function') {
        cb = params;
        params = {};
    }
    if (!params) params = {};
    
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
        reverse: params.reverse
    };
    var tr = new Transform({ objectMode: true });
    
    tr._transform = function (row, enc, next) {
        var key = bytewise.decode(Buffer(row.key, 'hex'));
        
        self.db.get(key[1], function (err, value) {
            if ((err && err.name === 'NotFoundError')
            || (value && value.type !== type)) {
                self._sublevel.del(row.key);
                return next();
            }
            else if (err) return next(err);
            
            if (params.augment !== false) {
                self._augment(key[1], value, { keys: params.keys === false });
            }
            
            if (params.keys === false) tr.push(value)
            else tr.push({ key: key[1], value: value })
            
            next();
        });
    };
    
    tr.createStream = function (opts) {
        if (!opts) opts = {};
        var stream = new Transform({ objectMode: true });
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
    
    if (params.follow) {
        return liveStream(this._sublevel, {
            tail: true,
            //old: params.old === undefined ? true : params.old,
            old: false,
            min: opts.start,
            max: opts.end,
            reverse: opts.reverse
        }).pipe(tr);
    }
    else return this._sublevel.createReadStream(opts).pipe(tr);
};

function Type (fns) {
    this._fns = fns;
}

Type.prototype.hasMany = function (key, type) {
    if (typeof type === 'string') type = [ 'type', type ];
    this._fns.hasMany(key, type);
    return this;
};

Type.prototype.belongsTo = function (type, key) {
    if (key === undefined && typeof type === 'string') key = [ type ];
    if (typeof type === 'string') type = [ 'type', type ];
    if (key === undefined) throw new Error(
        '`key` cannot be inferred with a non-string type.'
        + ' Specify a key.'
    );
    this._fns.belongsTo(type, key);
    return this;
};
