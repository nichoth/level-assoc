module.exports = Assoc;
function Assoc (db) {
    if (!(this instanceof Assoc)) return new Assoc(db);
    this.db = db;
}

Assoc.prototype.add = function (name) {
    return new Type(this.db, name);
};

Assoc.prototype.get = function (name, cb) {
    // ...
};

function Type (db, type) {
    this.db = db;
    this.type = type;
}

Type.prototype.hasMany = function (key, type) {
    if (type === undefined && typeof key === 'string') {
        type = key.replace(/s$/, '');
    }
    if (key === '') {
    }
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

Type.prototype.get = function (name) {
    console.dir(name);
};
