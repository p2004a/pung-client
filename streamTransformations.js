var Kefir = require("kefir").Kefir;

function toLineStream(stream) {
    return stream
        .map(function (token) {
            var res = token.split('\n').map(function (val) {
                return val + '\n';
            });
            res[res.length - 1] = res[res.length - 1].slice(0, -1);
            return res;
        })
        .flatten()
        .bufferWhile(function (val) {
            return val[val.length - 1] != '\n';
        }, {flushOnEnd: true})
        .map(function (arr) {
            return arr.join('').replace('\n', '');
        });
}

function group(stream, n) {
    return stream
        .scan(function (prev, next) {
            if (prev.length >= n) {
                prev = [];
            }
            prev.push(next);
            return prev;
        }, [])
        .filter(function (arr) {
            return arr.length == n;
        });
}

module.exports = {
    group: group,
    toLineStream: toLineStream
};
