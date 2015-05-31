require('./kefirExtend');
var Kefir = require("kefir").Kefir;

function toLineStream(stream) {
    return stream
        .map(function (token) {
            var res = token.split('\n').map(val => val + '\n');
            res[res.length - 1] = res[res.length - 1].slice(0, -1);
            return res;
        })
        .flatten()
        .bufferWhile(val => val.slice(-1) !== '\n')
        .map(arr => arr.join('').replace('\n', ''));
}

function group(n) {
    return function (stream) {
        return stream
            .scan(function (prev, next) {
                if (prev.length >= n) {
                    prev = [];
                }
                prev.push(next);
                return prev;
            }, [])
            .filter(arr => arr.length === n);
    };
}

function toMessages(stream) {
    function twoLinesToMessage(emitter, event) {
        switch (event.type) {
        case 'end':
            emitter.end();
            break;
        case 'error':
            emitter.error(event.value);
            break;
        case 'value':
            var lines = event.value;
            var headerRE = /^s(\d{1,9}) (?:c(\d{1,9}) )?([a-z_]{2,20})$/;
            var match = headerRE.exec(lines[0]);
            if (match === null) {
                emitter.error("Invalid header format of message from server");
            } else {
                emitter.emit({
                    sSeq: parseInt(match[1], 10),
                    cSeq: match[2] === undefined ? null : parseInt(match[2], 10),
                    message: match[3],
                    payload: lines[1] === '' ? [] : lines[1].split(' ')
                });
            }
            break;
        }
    }

    return stream
        .apply(toLineStream)
        .apply(group(2))
        .withHandler(twoLinesToMessage);
}

function timeout(timeout) {
    return stream => Kefir.merge([
        stream,
        Kefir.later(timeout, "client timeouted")
            .valuesToErrors()
    ])
        .endOnError()
        .take(1)
}

module.exports = {
    group: group,
    toLineStream: toLineStream,
    toMessages: toMessages,
    timeout: timeout
};
