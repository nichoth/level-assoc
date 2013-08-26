var sub = require('level-sublevel');
var level = require('level-test')();
var db = sub(level('test', { valueEncoding: 'json' }));

var assoc = require('../')(db);
assoc.add('hackerspace')
    .hasMany('hackers', [ 'type', 'hacker' ])
    .hasMany('tools', [ 'type', 'tool' ])
;

var rows = require('./data.json');
var spaces = rows.map(function (row) {
    return row.value.type === 'hackerspace' && row.key;
}).filter(Boolean);

db.batch(rows.map(function (row) {
    return { type: 'put', key: row.key, value: row.value };
}));

var http = require('http');
var server = http.createServer(function (req, res) {
    assoc.live('hackerspace').createStream().pipe(res);
});
server.listen(5000);

setTimeout(function () {
    var name = 'x' + Math.floor(Math.random() * Math.pow(16, 8)).toString(16);
    db.put(name, { type: 'hackerspace', name: name });
    spaces.push(name);
}, 2200);

setInterval(function () {
    var name = Math.floor(Math.random() * Math.pow(16, 8)).toString(16);
    var space = spaces[Math.floor(Math.random() * spaces.length)];
    db.put(name, { type: 'hacker', name: name, hackerspace: space });
}, 500);
