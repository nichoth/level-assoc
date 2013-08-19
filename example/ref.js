var sub = require('level-sublevel');
var level = require('level-test')();
var db = sub(level('test', { valueEncoding: 'json' }));

var assoc = require('../')(db);
assoc.add('hackerspace')
    .hasMany('hackers', [ 'type', 'hacker' ])
    .hasMany('tools', [ 'type', 'tool' ])
;
assoc.add('hacker').belongsTo('hackerspace');
assoc.add('tool')
    .hasMany('usage', [ 'type', 'usage' ])
    .belongsTo('hackerspace')
;

db.batch(require('./data.json').map(function (row) {
    return { type: 'put', key: row.key, value: row.value };
}), ready);

function ready () {
    assoc.get('sudoroom', function (err, room) {
        console.log('SUDOROOM=', room);
        room.hackers().on('data', function (r) {
            console.log('HACKER', r.value)
        });
    });

    assoc.get('8d9a83', function (err, tool) {
        console.log('TOOL=', tool);
        tool.usage().on('data', function (r) {
            console.log('USAGE', r.value)
        });
    });
}
