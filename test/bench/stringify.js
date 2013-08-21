var sub = require('level-sublevel');
var level = require('level');
var db = sub(level('/tmp/assoc-bench.db', { valueEncoding: 'json' }));

var assoc = require('../../')(db);
assoc.add('hackerspace')
    .hasMany('hackers', [ 'type', 'hacker' ])
    .hasMany('tools', [ 'type', 'tool' ])
;

db.batch(require('./data.json').map(function (row) {
    return { type: 'put', key: row.key, value: row.value };
}), ready);

function ready () {
    var t0 = Date.now();
    assoc.get('sudo', function (err, room) {
        var t1 = Date.now();
        //room.hackers().on('data', console.log).on('end', function () {
        room.hackers()
            .on('data', function () {})
            .on('end', function () {
                var t2 = Date.now();
                console.log(t1 - t0);
                console.log(t2 - t1);
            })
        ;
    });
}
