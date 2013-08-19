var test = require('tape');
var concat = require('concat-stream');

var sub = require('level-sublevel');
var level = require('level-test')();
var db = sub(level('test', { valueEncoding: 'json' }));
var expected = require('./stringify.json');

var assoc = require('../')(db);
assoc.add('hackerspace')
    .hasMany('hackers', [ 'type', 'hacker' ])
    .hasMany('tools', [ 'type', 'tool' ])
;

test('setup', function (t) {
    db.batch(require('./data.json').map(function (row) {
        return { type: 'put', key: row.key, value: row.value };
    }), function () { t.end() });
});

test('stringify', function (t) {
    t.plan(1);
    assoc.get('sudoroom').createStream().pipe(concat(function (body) {
        t.deepEqual(JSON.parse(body), expected);
    }));
});
