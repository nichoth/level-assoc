var pathway = require('pathway');

module.exports = Assoc;
function Assoc (db) {
    if (!(this instanceof Assoc)) return new Assoc(db);
    this.db = db;
    this._types = {};
}

Assoc.prototype.add = function (name) {
    var t = new Type(name);
    this._types[name] = t;
    return t;
};

Assoc.prototype.get = function (name, cb) {
    var self = this;
    this.db.get(name, function (err, row) {
        if (err) return cb(err);
        var t = self._types[row.type];
        
        Object.keys(t._has).forEach(function (key) {
            row[key] = 'PLACHEOLDER';
        });
        
        cb(null, row);
    });
};

function Type (type) {
    this.type = type;
    this._has = {};
}

Type.prototype.hasMany = function (key, type) {
    if (typeof type === 'string') type = [ 'type', type ];
    this._has[key] = type;
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
