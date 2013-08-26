var sub = require('level-sublevel');
var level = require('level-test')();
var db = sub(level('test', { valueEncoding: 'json' }));

var assoc = require('../')(db);
assoc.add('hackerspace')
    .hasMany('hackers', [ 'type', 'hacker' ])
    .hasMany('tools', [ 'type', 'tool' ])
;

var rows = require('./data.json');
var spaces = rows.filter(function (row) {
    return row.value.type === 'hackerspace';
});
db.batch(rows.map(function (row) {
    return { type: 'put', key: row.key, value: row.value };
}), ready);

function ready () {
    var stream = assoc.live('hackerspace', {
        gte: 'sudoroom'
    });
    stream.on('data', console.log);
}

setInterval(function () {
    var name = Math.floor(Math.random() * Math.pow(16, 8).toString(16));
    var space = spaces[Math.floor(Math.random() * spaces.length)].key;
    db.put(name, { type: 'hacker', name: name, hackerspace: space });
}, 500);
