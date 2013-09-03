module.exports = Type;

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
