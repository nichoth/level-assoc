var sub = require('level-sublevel');
var level = require('level-test')();
var db = sub(level('test', { valueEncoding: 'json' }));

var through = require('through');

var assoc = require('../')(db);
assoc.add('hackerspace')
    .hasMany('hackers', [ 'type', 'hacker' ])
    .hasMany('tools', [ 'type', 'tool' ])
;
var parser = require('../parse');

db.batch(require('./data.json').map(function (row) {
    return { type: 'put', key: row.key, value: row.value };
}), ready);

function ready () {
    assoc.live('hackerspace', { old: true, meta: true }).createStream()
        .pipe(parser())
        .pipe(through(function (row) {
            row.value.hackers().on('data', function (h) {
                console.log(row.key, ' ', h);
            });
        })
    );
}
