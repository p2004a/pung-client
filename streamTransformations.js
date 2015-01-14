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

function toMessages(stream) {
    stream = toLineStream(stream);
    stream = group(stream, 2);

    function linesToMessage(lines) {
        var headerRE = /^s(\d{1,9}) (?:c(\d{1,9}) )?([a-z_]{2,20})$/;
        var match = headerRE.exec(lines[0]);
        if (match === null) {
            return {error: "Invalid header format of message from server", value: null};
        }

        var msg = {
            sSeq: parseInt(match[1], 10),
            cSeq: match[2] === undefined ? null : parseInt(match[2], 10),
            message: match[3],
            payload: lines[1] === '' ? [] : lines[1].split(' ')
        };
        return {error: null, value: msg};
    }

    return stream.withHandler(function (emitter, event) {
        switch (event.type) {
        case 'end':
            emitter.end();
            break;
        case 'error':
            emitter.error(event.value);
            break;
        case 'value':
            var res = linesToMessage(event.value);
            if (res.error) {
                emitter.error(res.error);
            } else {
                emitter.emit(res.value);
            }
            break;
        }
    });
}

function toOneResTimeoutingStream(resStream, timeout) {
    return Kefir.merge([
        resStream,
        Kefir.later(timeout, "timeouted")
            .valuesToErrors()
    ])
        .endOnError()
        .take(1)
        .onEnd(function () {
            resStream.unregister();
        });
}

module.exports = {
    group: group,
    toLineStream: toLineStream,
    toMessages: toMessages,
    toOneResTimeoutingStream: toOneResTimeoutingStream
};
