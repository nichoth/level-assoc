var sub = require('level-sublevel');
var level = require('level-test')();
var db = sub(level('test', { valueEncoding: 'json' }));

var parse = require('../parse');
var assoc = require('../')(db);
assoc.add('hackerspace')
    .hasMany('hackers', [ 'type', 'hacker' ])
    .hasMany('tools', [ 'type', 'tool' ])
;

db.batch(require('./data.json').map(function (row) {
    return { type: 'put', key: row.key, value: row.value };
}), ready);

function ready () {
    assoc.list('hackerspace').createStream()
        .pipe(parse())
        .pipe(through(function (row) {
            console.log(row.key);
            row.value.hackers().on('data', function (h) {
                console.log('  ', h);
            });
        })
    );
}
