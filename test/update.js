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
    }), ready);
    
    function ready () {
        setTimeout(function () {
            db.put('substack', {
                "type": "hacker",
                "name": "substack",
                "hackerspace": "noisebridge"
            });
        }, 100);
        setTimeout(function () { t.end() }, 200);
    }
});

var sudoroomHackers = [
    {key:"maxogden",value:{type:'hacker',name:'maxogden',hackerspace:'sudoroom'}},
    {key:'wrought',value:{type:'hacker',name:'wrought',hackerspace:'sudoroom'}}
];

var noisebridgeHackers = [
  {key:"ioerror",value:{type:"hacker",name:"ioerror",hackerspace:"noisebridge"}},
  {key:"mitch",value:{type:"hacker",name:"mitch",hackerspace:"noisebridge"}},
  {key:"substack",value:{type:"hacker",name:"substack",hackerspace:"noisebridge"}}
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

test('updated', function (t) {
    t.plan(7);
    
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
                t.deepEqual(hackers, sudoroomHackers);
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
    
    assoc.get('noisebridge', function (err, room) {
        var hackers = [];
        room.hackers()
            .on('data', function (row) { hackers.push(row) })
            .on('end', function () {
                t.deepEqual(hackers, noisebridgeHackers);
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
