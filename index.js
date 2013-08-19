var bytewise = require('bytewise');
var Transform = require('readable-stream/transform');
var foreignKey = require('foreign-key');

module.exports = Assoc;
function Assoc (db) {
    if (!(this instanceof Assoc)) return new Assoc(db);
    this.db = db;
    this._sublevel = db.sublevel('associations');
    this._foreign = {};
    this._has = [];
    this._hasKeys = {};
    
    var self = this;
    db.hooks.post({ start: '', end: '~' }, function (change) {
        if (change.type === 'put') {
            var value = JSON.parse(change.value);
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
    return new Type(function (k, type) {
        self._has.push([ type, k, key ]);
        self._hasKeys[key][k] = type;
        self._foreign[key].add(k, type, key);
    });
};

Assoc.prototype._postPut = function (key, value, cb) {
    if (!value) return cb();
    var pending = 0;
    var self = this;
    
    for (var i = 0, li = this._has.length; i < li; i++) {
        var ts = this._has[i][0];
        var cur = value;
        for (var cur, j = 0, lj = ts.length - 1; j < lj; j++) {
            cur = cur[ts[j]];
            if (cur === undefined) break;
        }
        if (j !== lj || cur !== ts[j]) continue;
        
        var topKey = this._has[i][2];
        var fkey = this._foreign[topKey].keyList(key, value);
        if (fkey) {
            var k = bytewise.encode([topKey].concat(fkey)).toString('hex');
            pending ++;
            this._sublevel.put(k, 0, function (err) {
                if (err) cb(err)
                else if (--pending === 0) cb()
                
            });
        }
    }
    
    if (pending === 0) cb();
};

Assoc.prototype.get = function (topKey, cb) {
    var self = this;
    this.db.get(topKey, function (err, row) {
        if (err) return cb(err);
        
        var keyTypes = self._hasKeys[row.type];
        
        Object.keys(keyTypes).forEach(function (key) {
            var type = keyTypes[key];
            
            row[key] = function () {
                return self._collectStream(topKey, key, row);
            };
        });
        
        cb(null, row);
    });
};

Assoc.prototype._collectStream = function (topKey, key, row) {
    var self = this;
    var start = [ row.type, topKey, key ];
    var end = [ row.type, topKey, key, undefined ];
    
    var opts = {
        start: bytewise.encode(start).toString('hex'),
        end: bytewise.encode(end).toString('hex')
    };
    var tr = new Transform({ objectMode: true });
    tr._transform = function (row, enc, next) {
        var parts = bytewise.decode(Buffer(row.key, 'hex'));
        self.db.get(parts[3], function (err, value) {
            if (err && err.name === 'NotFoundError') {
                // lazily remove deleted indexes
                self._sublevel.del(row.key);
                return next();
            }
            else if (err) return next(err);
            tr.push({ key: parts[3], value: value });
            next();
        });
    };
    tr._flush = function (next) {
        next();
    };
    return self._sublevel.createReadStream(opts).pipe(tr);
};

function Type (cb) {
    this._cb = cb;
}

Type.prototype.hasMany = function (key, type) {
    if (typeof type === 'string') type = [ 'type', type ];
    this._cb(key, type);
    return this;
};

Type.prototype.belongsTo = function (type, key) {
    if (key === undefined && typeof type === 'string') key = [ type ];
    if (typeof type === 'string') type = [ 'type', type ];
    if (key === undefined) throw new Error(
        '`key` cannot be inferred with a non-string type.'
        + ' Specify a key.'
    );
    return this;
};
