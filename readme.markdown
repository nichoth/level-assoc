# level-assoc

foreign key
[associations](http://api.rubyonrails.org/classes/ActiveRecord/Associations/ClassMethods.html)
(hasMany, belongsTo, ...)
for [leveldb](https://github.com/rvagg/node-levelup)

[![build status](https://secure.travis-ci.org/substack/level-assoc.png)](http://travis-ci.org/substack/level-assoc)

# example

## fetch associated documents

``` js
var sub = require('level-sublevel');
var level = require('level');
var db = sub(level('hackerspaces.db', { valueEncoding: 'json' }));

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
        console.log(room);
        room.hackers().on('data', console.log);
    });
}
```

Given the data in [data.json](example/data.json),
the program first prints the record for sudoroom,
then prints all the hackers at sudoroom:

```
{ type: 'hackerspace',
  name: 'sudoroom',
  hackers: [Function],
  tools: [Function] }
{ key: 'maxogden',
  value: { type: 'hacker', name: 'maxogden', hackerspace: 'sudoroom' } }
{ key: 'mk30',
  value: { type: 'hacker', name: 'mk30', hackerspace: 'sudoroom' } }
{ key: 'substack',
  value: { type: 'hacker', name: 'substack', hackerspace: 'sudoroom' } }
{ key: 'wrought',
  value: { type: 'hacker', name: 'wrought', hackerspace: 'sudoroom' } }
{ key: 'yardena',
  value: { type: 'hacker', name: 'yardena', hackerspace: 'sudoroom' } }
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

* `opts.gt` - key to start at, exclusive
* `opts.gte` - key to start at, inclusive
* `opts.lt` - key to end at, exclusive
* `opts.lte` - key to end at, inclusive
* `opts.start` - key to start at, inclusive (same as `opts.gte`)
* `opts.end` - key to end at, inclusive
* `opts.keys` - when false, only return `"value"` contents in results.
default: true

* `opts.follow` - keep sending new updates as they occur, default: false
* `opts.flat` - produce results in a flat, normalized form with all children
records at the top-level
* `opts.old` - when in follow mode, whether to include old results or only new,
live updates

## var rec = assoc.live(type, opts={}, cb)

Return an object stream the same as `assoc.list()` with `opts.flat` and
`opts.follow` set to `true` and `opts.old` set to false.

This is very convenient for wiring up real time feeds to a data set.

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
