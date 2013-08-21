var sub = require('level-sublevel');
var level = require('level-test')();
var db = sub(level('test', { valueEncoding: 'json' }));

var assoc = require('../')(db);
assoc.add('hackerspace')
    .hasMany('hackers', [ 'type', 'hacker' ])
    .hasMany('tools', [ 'type', 'tool' ])
;

db.batch(require('./data.json').map(function (row) {
    return { type: 'put', key: row.key, value: row.value };
}), ready);

function ready () {
    var stream = assoc.list('hackerspace', {
        lte: 'noisebridge',
        follow: true
    });
    stream.on('data', console.log);
}

setInterval(function () {
    var name = Math.floor(Math.random() * Math.pow(16, 8).toString(16));
    db.put(name, { type: 'hackerspace', name: name });
}, 500);
