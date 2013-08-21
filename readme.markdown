# level-assoc

foreign key
[associations](http://api.rubyonrails.org/classes/ActiveRecord/Associations/ClassMethods.html)
(hasMany, belongsTo, ...)
for [leveldb](https://github.com/rvagg/node-levelup)

[![build status](https://secure.travis-ci.org/substack/level-assoc.png)](http://travis-ci.org/substack/level-assoc)

# example

``` js
var sub = require('level-sublevel');
var level = require('level-test')();
var db = sub(level('test', { valueEncoding: 'json' }));

var assoc = require('level-assoc')(db);
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
```

given this `data.json` in the database:

``` json
[
  {"key":"sudoroom","value":{"type":"hackerspace","name":"sudoroom"}},
  {"key":"noisebridge","value":{"type":"hackerspace","name":"noisebridge"}},
  {"key":"substack","value":{"type":"hacker","name":"substack","hackerspace":"sudoroom"}},
  {"key":"maxogden","value":{"type":"hacker","name":"maxogden","hackerspace":"sudoroom"}},
  {"key":"ioerror","value":{"type":"hacker","name":"ioerror","hackerspace":"noisebridge"}},
  {"key":"mitch","value":{"type":"hacker","name":"mitch","hackerspace":"noisebridge"}},
  {"key":"wrought","value":{"type":"hacker","name":"wrought","hackerspace":"sudoroom"}},
  {"key":"mk30","value":{"type":"hacker","name":"mk30","hackerspace":"sudoroom"}},
  {"key":"8d9a83","value":{"type":"tool","name":"3d printer","hackerspace":"sudoroom"}},
  {"key":"ea7e66","value":{"type":"tool","name":"piano","hackerspace":"sudoroom"}},
  {"key":"025452","value":{"type":"tool","name":"laser cutter","hackerspace":"noisebridge"}},
  {"key":"yardena","value":{"type":"hacker","name":"yardena","hackerspace":"sudoroom"}},
  {"key":"5cc709","value":{"type":"tool","name":"3d printer","hackerspace":"noisebridge"}},
  {"key":"d06ab1","value":{"type":"usage","tool":"8d9a83","minutes":"45","user":"maxogden"}},
  {"key":"2454c1","value":{"type":"usage","tool":"8d9a83","minutes":"20","user":"yardena"}},
  {"key":"ec08ed","value":{"type":"usage","tool":"ea7e66","minutes":"14","user":"substack"}},
  {"key":"61baab","value":{"type":"usage","tool":"025452","minutes":"8","user":"mitch"}}
]
```

the program prints:

```
SUDOROOM= { type: 'hackerspace',
  name: 'sudoroom',
  hackers: [Function],
  tools: [Function] }
TOOL= { type: 'tool',
  name: '3d printer',
  hackerspace: 'sudoroom',
  usage: [Function] }
HACKER { type: 'hacker', name: 'maxogden', hackerspace: 'sudoroom' }
USAGE { type: 'usage', tool: '8d9a83', minutes: '20', user: 'yardena' }
HACKER { type: 'hacker', name: 'mk30', hackerspace: 'sudoroom' }
USAGE { type: 'usage', tool: '8d9a83', minutes: '45', user: 'maxogden' }
HACKER { type: 'hacker', name: 'substack', hackerspace: 'sudoroom' }
HACKER { type: 'hacker', name: 'wrought', hackerspace: 'sudoroom' }
HACKER { type: 'hacker', name: 'yardena', hackerspace: 'sudoroom' }
```

## stringify

Using the same dataset, we can stream stringify the nested records for sudoroom:

``` js
var sub = require('level-sublevel');
var level = require('level-test')();
var db = sub(level('test', { valueEncoding: 'json' }));

var assoc = require('level-assoc')(db);
assoc.add('hackerspace')
    .hasMany('hackers', [ 'type', 'hacker' ])
    .hasMany('tools', [ 'type', 'tool' ])
;

db.batch(require('./data.json').map(function (row) {
    return { type: 'put', key: row.key, value: row.value };
}), ready);

function ready () {
    assoc.get('sudoroom').createStream().pipe(process.stdout);
}
```

output:

```
{"type":"hackerspace","name":"sudoroom","hackers":[{"key":"maxogden","value":{"type":"hacker","name":"maxogden","hackerspace":"sudoroom"}},{"key":"mk30","value":{"type":"hacker","name":"mk30","hackerspace":"sudoroom"}},{"key":"substack","value":{"type":"hacker","name":"substack","hackerspace":"sudoroom"}},{"key":"wrought","value":{"type":"hacker","name":"wrought","hackerspace":"sudoroom"}},{"key":"yardena","value":{"type":"hacker","name":"yardena","hackerspace":"sudoroom"}}],"tools":[{"key":"8d9a83","value":{"type":"tool","name":"3d printer","hackerspace":"sudoroom"}},{"key":"ea7e66","value":{"type":"tool","name":"piano","hackerspace":"sudoroom"}}]}
```

## list

You can also pull down a list of all hackerspaces as a stream by calling
`assoc.list('hackerspaces')`:

``` js
var sub = require('level-sublevel');
var level = require('level-test')();
var db = sub(level('test', { valueEncoding: 'json' }));

var assoc = require('level-assoc')(db);
assoc.add('hackerspace')
    .hasMany('hackers', [ 'type', 'hacker' ])
    .hasMany('tools', [ 'type', 'tool' ])
;

db.batch(require('./data.json').map(function (row) {
    return { type: 'put', key: row.key, value: row.value };
}), ready);

function ready () {
    assoc.list('hackerspace').on('data', console.log);
}
```

output:

``` js
{ key: 'noisebridge',
  value: 
   { type: 'hackerspace',
     name: 'noisebridge',
     hackers: [Function],
     tools: [Function] } }
{ key: 'sudoroom',
  value: 
   { type: 'hackerspace',
     name: 'sudoroom',
     hackers: [Function],
     tools: [Function] } }
```

# methods

``` js
var levelAssoc = require('level-assoc')
```

## var assoc = levelAssoc(db)

Create a new `assoc` instance from a
[sublevel-enabled](https://npmjs.org/package/level-sublevel)
leveldb instance `db`.

## var rec = assoc.get(key, cb)

Fetch a `key` from the database with `cb(err, row)`.
`row` contains the underlying `db.get()` result but augmented with functions to
return streams for the has-many collections.

For each augmented `relation` function, `row[relation](cb)` will return a stream
with the list of the related rows. Optionally pass in `cb(err, rows)` to buffer
the list of `rows`.

## var rec = assoc.list(type, opts={}, cb)

Return an object stream `rec` with all the rows of `type`.

`cb(err, rows)` will fire with the buffered array of results `rows` if provided.

Optionally:

* `opts.follow` - keep sending new updates as they occur, default: false
* `opts.gt` - key to start at, exclusive
* `opts.gte` - key to start at, inclusive
* `opts.lt` - key to end at, exclusive
* `opts.lte` - key to end at, inclusive
* `opts.start` - key to start at, inclusive (same as `opts.gte`)
* `opts.end` - key to end at, inclusive

## rec.createStream()

Return a stream with the expanded json representation of the row or rows from
`assoc.get()` or `assoc.list()` with children rows expanded.

## var t = assoc.add(name)

Create a new type association `t` for rows with a `"type"` field set to `name`.

## t.hasMany(key, filterKey)

Create a streaming collection at `key` for foreign rows matching the string
array path `filterKey`.

## t.belongsTo(key)

TODO. Currently a no-op.

# install

With [npm](https://npmjs.org) do:

```
npm install level-assoc
```

# license

MIT
