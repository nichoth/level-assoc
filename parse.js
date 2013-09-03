var through = require('through');
var combine = require('stream-combiner');
var split = require('split');
var Readable = require('readable-stream');
var matches = require('./lib/matches.js');

module.exports = function () {
    var streams = {};
    var meta;
    return combine(split(), through(write));
    
    function write (buf) {
        var line = typeof buf === 'string' ? buf : buf.toString('utf8');
        
        try { var row = JSON.parse(line) }
        catch (e) { return };
        
        if (row.type === 'meta' && row.key === undefined) {
            meta = row.value;
        }
        else if (meta && row && row.value && meta[row.value.type]) {
            if (!streams[row.value.type]) streams[row.value.type] = {};
            if (!streams[row.value.type][row.key]) {
                streams[row.value.type][row.key] = {};
            }
            this.queue(augment(row));
        }
        else if (row && row.value) {
            Object.keys(streams).forEach(function (key) {
                if (!row.value[key]) return;
                if (!streams[key][row.value[key]]) return;
                
                var s = streams[key][row.value[key]];
                if (!s) return;
                Object.keys(meta[key]).forEach(function (k) {
                    if (matches(row.value, meta[key][k])) {
                        s[k].push(row);
                    }
                });
            });
        }
    }
    
    function augment (row) {
        var m = meta[row.value.type];
        Object.keys(m).forEach(function (key) {
            var rs = new Readable({ objectMode: true });
            rs._read = function () {};
            
            streams[row.value.type][row.key][key] = rs;
            
            row.value[key] = function () { return rs };
        });
        return row;
    }
};
