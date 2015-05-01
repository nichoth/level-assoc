var test = require('tape');
var sub = require('level-sublevel');
var level = require('level-test')();
var db = sub(level('live-test', { valueEncoding: 'json' }));

var assoc = require('../')(db);
assoc.add('hackerspace')
    .hasMany('hackers', [ 'type', 'hacker' ])
    .hasMany('tools', [ 'type', 'tool' ])
;

var data = require('./data.json');

test('setup', function (t) {
    db.batch(data.map(function (row) {
        return { type: 'put', key: row.key, value: row.value };
    }), function () { t.end(); });
});

test('list', function(t) {
    t.plan(1);
    var stream = assoc.list('hackerspace', function(err, rows) {
        if (err) t.fail(err);
        t.equal(rows.length, 2);
    });
});

test('live', function(t) {
    t.plan(1);
    var newSpace = { type: 'hackerspace', name: 'sudoroom2' };
    var stream = assoc.live('hackerspace');

    setTimeout(function() {
        db.put(newSpace.name, newSpace);
    }, 300);

    stream.on('data', function(row) {
        t.deepEqual(row, {key: newSpace.name, value: newSpace});
    });

});
