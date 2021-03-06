var through = require('through');
var combine = require('stream-combiner');
var split = require('split');
var matches = require('./lib/matches.js');

module.exports = function (opts) {
    if (!opts) opts = {};
    var streams = {};
    var meta;
    var stream = combine(split(), through(write));
    stream.pause = function () {};
    return stream;
    
    function write (buf) {
        var line = typeof buf === 'string' ? buf : buf.toString('utf8');
        
        try { var row = JSON.parse(line) }
        catch (e) { return };
        
        if (row.type === 'meta' && row.key === undefined) {
            meta = row.value;
            stream.emit('meta', meta);
        }
        else if (meta && row && row.value && meta[row.value.type]) {
            if (!streams[row.value.type]) streams[row.value.type] = {};
            if (!streams[row.value.type][row.key]) {
                streams[row.value.type][row.key] = {};
            }
            this.queue(augment(row));
        }
        else if (row && row.value) {
            var matched = false;
            for (var key in streams) {
                if (!row.value[key]) continue;
                if (!streams[key][row.value[key]]) continue;
                
                var s = streams[key][row.value[key]];
                if (!s) return;
                for (var k in meta[key]) {
                    if (matches(row.value, meta[key][k])) {
                        s[k].push(row);
                        matched = true;
                        break;
                    }
                }
            }
        }
    }
    
    function augment (row) {
        var m = meta[row.value.type];
        Object.keys(m).forEach(function (key) {
            var rs = through().pause();
            rs.startKeys = [ null, row.value.type, row.key, key ];
            rs.endKeys = [ null, row.value.type, row.key, key, undefined ];
            
            streams[row.value.type][row.key][key] = rs;
            
            row.value[key] = function () {
                stream.emit('augment', row, key, rs);
                var resume = rs.resume, pause = rs.pause;
                var paused = false;
                rs.resume = function () { paused = false };
                rs.pause = function () { paused = true };
                process.nextTick(function () {
                    rs.resume = resume;
                    rs.pause = pause;
                    if (!paused) resume();
                });
                return rs;
            };
        });
        return row;
    }
};
