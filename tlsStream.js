var net = require("net");
var tls = require("tls");
var Kefir = require("kefir").Kefir;

function createTLSStream(hostname, port, timeout) {
    'use strict';

    var streamData = {
        readBuffer: "",
        endReadStream: false,
        readErrors: [],
        emitter: null
    };

    var connectedStream = Kefir.emitter();
    var connected = false;

    var stream = Kefir.fromBinder(function (emitter) {
        streamData.emitter = emitter;

        // setTimeout to ensure that sequential calls to onValue, onError, onEnd will finish registration;
        setTimeout(function () {
            if (streamData.readBuffer.length > 0) {
                emitter.emit(streamData.readBuffer);
                streamData.readBuffer = "";
            }
            streamData.readErrors.forEach(function (err) {
                emitter.error(err);
            });
            streamData.readErrors = [];
            if (streamData.endReadStream) {
                emitter.end();
            }
        }, 0);

        return function () {
            streamData.emitter = null;
        };
    });

    function streamError(err) {
        if (!connected) {
            connectedStream.error(err.message);
        } else if (streamData.emitter) {
            streamData.emitter.error(err.message);
        } else {
            streamData.readErrors.push(err.message);
        }
    }

    function streamClose() {
        if (!connected) {
            connectedStream.end();
        } if (streamData.emitter) {
            streamData.emitter.end();
        } else {
            streamData.endReadStream = true;
        }
    }

    var socket = net.connect({
        host: hostname,
        port: 24948,
        allowHalfOpen: false
    }, function () {
        var cleartextStream = tls.connect({
            socket: socket,
            rejectUnauthorized: false,
            servername: "localhost"
        }, function () {
            stream.emit = function (val) {
                cleartextStream.write(val, 'utf8');
            };

            stream.end = function () {
                if (streamData.emitter) {
                    streamData.emitter.end();
                } else {
                    streamData.endReadStream = true;
                }
                cleartextStream.end();
            };

            cleartextStream.on('data', function(data) {
                if (streamData.emitter) {
                    streamData.emitter.emit(data);
                } else {
                    streamData.readBuffer += data;
                }
            });

            connected = true;
            connectedStream.emit(stream);
            connectedStream.end();
        });

        cleartextStream.setEncoding('utf8');

        cleartextStream.on('end', function() {
            socket.end();
        });

        cleartextStream.on('close', streamClose);
        cleartextStream.on('error', streamError);
    });
    socket.setKeepAlive(true, 1000 * 30);

    socket.on('error', streamError);
    socket.on('close', streamClose);

    if (timeout) {
        setTimeout(function () {
            connectedStream.error('timeout');
            connectedStream.end();
            socket.end();
        }, timeout);
    }

    return connectedStream;
}

module.exports = {
    create: createTLSStream
};
