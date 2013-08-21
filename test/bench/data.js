var spaces = [];

var makeSpace = (function () {
    var words = [
        'sudo', 'noise', 'room', 'bridge', 'nyc', 'sf', 'resistor', 'hack',
        'pad', 'base', 'meta', 'lab', 'space', 'back'
    ];
    var exists = {};
    
    return function () {
        var name = mutate(words, exists);
        spaces.push(name);
        exists[name] = true;
        
        return {
            key: name,
            value: { type: 'hackerspace', name: name }
        };
    };
})();

var makeHacker = (function () {
    var words = [
        'sub', 'stack', 'max', 'over', 'drive', 'ride', 'zero', 'cool', 'acid',
        'burn', 'fire', 'fox', 'hacker', 'elite', 'hack', 'dark', 'knight'
    ];
    var hackers = {};
    
    return function () {
        var name = mutate(words, hackers);
        var space = spaces[Math.floor(Math.random() * spaces.length)];
        hackers[name] = true;
        return {
            key: name,
            value: { type: 'hacker', name: name, hackerspace: space }
        };
    };
})();

process.stdout.write('[');
for (var i = 0; i < 100000; i++) {
    var doc;
    if (i < 5 || Math.random() < 0.1) {
        doc = makeSpace();
    }
    else doc = makeHacker();
    var s = JSON.stringify(doc);
    process.stdout.write(i > 0 ? '\n,' + s : s);
}
console.log(']\n');

function mutate (words, exists) {
    var name = '';
    var min = Math.random() * 8 + 2;
    
    do {
        var n = Math.random();
        if (n < 0.1) {
            name += String.fromCharCode(97 + Math.random() * 26);
        }
        else if (n.length && n < 0.3) {
            name += Math.floor(Math.random() * 100);
        }
        else {
            var thresh = Math.random();
            name += words[Math.floor(Math.random() * words.length)]
                .replace(/./g, function (s) {
                    if (Math.random() < thresh) {
                        var x = {
                            'o': [ '0', '*', '()' ],
                            'a': [ '4', '@' ],
                            'i': [ '1', '!' ],
                            'b': '8',
                            'e': '3',
                            's': [ '5', '$' ],
                            'h': [ '4', '#' ],
                            'f': 'ph',
                            'x': '%',
                        }[s];
                        if (!x) return s;
                        x = [].concat.call(x);
                        return x[Math.floor(Math.random() * x.length)];
                    }
                    else return s;
                })
            ;
        }
    }
    while (exists[name] || name.length < min);
    return name;
}
