var test = require('tape');
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

test('setup', function (t) {
    db.batch(require('./data.json').map(function (row) {
        return { type: 'put', key: row.key, value: row.value };
    }), function () { t.end() });
});

var expectedHackers = [
    {
        key: "maxogden",
        value: {
            type: 'hacker',
            name: 'maxogden',
            hackerspace: 'sudoroom'
        }
    },
    {
        key: 'substack',
        value: {
            type: 'hacker',
            name: 'substack',
            hackerspace: 'sudoroom'
        }
    },
    {
        key: 'wrought',
        value: {
            type: 'hacker',
            name: 'wrought',
            hackerspace: 'sudoroom'
        }
    }
];

var expectedUsage = [
    {
        key: 'd06ab1',
        value: {
            type: 'usage',
            tool: '8d9a83',
            minutes: '45',
            user: 'maxogden'
        }
    }
];

var expectedTools = [
    {
        key: "8d9a83",
        value: {
            type: "tool",
            name: "3d printer",
            hackerspace: "sudoroom"
        }
    },
    {
        key: "ea7e66",
        value: {
            type: "tool",
            name: "piano",
            hackerspace: "sudoroom"
        }
    }
];

test('refs', function (t) {
    t.plan(3);
    
    assoc.get('sudoroom', function (err, room) {
        if (err) t.fail(err);
        t.deepEqual(
            Object.keys(room).sort(),
            [ 'hackers', 'name', 'tools', 'type' ]
        );
        t.equal(room.name, 'sudoroom');
        t.equal(room.type, 'hackerspace');
        
        var hackers = [];
        room.hackers()
            .on('data', function (row) { hackers.push(row) })
            .on('end', function () {
                t.deepEqual(hackers, expectedHackers);
            })
        ;
        var tools = [];
        room.tools()
            .on('data', function (row) { tools.push(row) })
            .on('end', function () {
                t.deepEqual(tools, expectedTools);
            })
        ;
    });
    
    assoc.get('8d9a83', function (err, tool) {
        var usage = [];
        tool.usage()
            .on('data', function (row) { usage.push(row) })
            .on('end', function () {
                t.deepEqual(usage, expectedUsage);
            })
        ;
    });
});
