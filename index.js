var pathway = require('pathway');
var bytewise = require('bytewise');
var Transform = require('readable-stream/transform');
var foreignKey = require('foreign-key');

module.exports = Assoc;
function Assoc (db) {
    if (!(this instanceof Assoc)) return new Assoc(db);
    this.db = db;
    this._sublevels = {};
    this._foreign = {};
    this._has = [];
    this._hasKeys = {};
}

Assoc.prototype.add = function (topType) {
    if (typeof topType === 'string') topType = [ 'type', topType ];
    var key = topType.join('\0');
    
    this._foreign[key] = foreignKey(topType);
    this._sublevels[key] = this.db.sublevel('assoc-' + key);
    this._hasKeys[key] = {};
    
    var self = this;
    return new Type(function (k, type) {
        self._has.push([ type, k, topType ]);
        self._hasKeys[key][k] = type;
    });
};

Assoc.prototype._PUT = function (key, value) {
    if (!value) return;
    if (this._foreign[value.type]) {
        // ...
    }
    
    for (var i = 0, li = this._has.length; i < li; i++) {
        var ts = this._has[i][0];
        var cur = value;
        for (var cur, j = 0, lj = ts.length - 1; j < lj; j++) {
            cur = cur[ts[j]];
            if (cur === undefined) break;
        }
        if (j !== lj || cur !== ts[j]) continue;
        console.log(ts, value);
    }
    
    //this._sublevels[value.type].put(key, value);
    //console.log('rkey=', [ key, value ]);
    //this.db.put(key, value);
};

Assoc.prototype.get = function (topKey, cb) {
    var self = this;
    this.db.get(topKey, function (err, row) {
        if (err) return cb(err);
        
        return; // whatever
        var t = self._hasKeys[row.type];
        Object.keys(t._hasKeys).forEach(function (key) {
            var type = t._hasKeys[key];
            
            row[key] = function () {
                var opts = {
                    /*
                    start: bytewise.encode(),
                    end: ''
                    */
                };
                var tr = new Transform({ objectMode: true });
                tr._transform = function (row, enc, next) {
                    // ...
                };
                tr._flush = function (next) {
                    next();
                };
                return self.db.createReadStream(opts).pipe(tr);
            };
        });
        
        cb(null, row);
    });
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
