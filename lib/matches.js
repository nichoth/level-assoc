module.exports = function (obj, keypath) {
    var cur = obj;
    for (var cur, i = 0, l = keypath.length - 1; i < l; i++) {
        cur = cur[keypath[i]];
        if (cur === undefined) return false;
    }
    return cur === keypath[i];
}
