var net = require("net");
var tls = require("tls");
var Kefir = require("kefir").Kefir;

function createTLSStream(hostname, port) {
    'use strict';

    var streamData = {
        readBuffer: "",
        writeBuffer: "",
        endWriteStream: false,
        endReadStream: false,
        readErrors: [],
        emitter: null
    };

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

    stream.emit = function (val) {
        streamData.writeBuffer += val;
    };

    stream.end = function () {
        streamData.endWriteStream = true;
    };

    var socket = net.connect({
        host: "localhost",
        port: 24948,
        allowHalfOpen: false
    }, function () {
        var cleartextStream = tls.connect({
            socket: socket,
            rejectUnauthorized: false,
            servername: "localhost"
        });

        cleartextStream.setEncoding('utf8');

        stream.emit = function (val) {
            cleartextStream.write(val, 'utf8');
        };

        stream.end = function () {
            cleartextStream.end();
        };

        cleartextStream.on('data', function(data) {
            if (streamData.emitter) {
                streamData.emitter.emit(data);
            } else {
                streamData.readBuffer += data;
            }
        });

        cleartextStream.on('end', function() {
            socket.end();
        });

        cleartextStream.on('error', function (err) {
            if (streamData.emitter) {
                streamData.emitter.error(err);
            } else {
                streamData.readErrors.push(err);
            }
            socket.end();
        });

        if (streamData.writeBuffer.length > 0) {
            stream.emit(streamData.writeBuffer);
            streamData.writeBuffer = null;
        }

        if (streamData.endWriteStream) {
            stream.end();
        }
    });
    socket.setKeepAlive(true, 1000 * 30);

    socket.on('error', function (err) {
        if (streamData.emitter) {
            streamData.emitter.error(err.message);
        } else {
            streamData.readErrors.push(err.message);
        }
    });

    socket.on('close', function () {
        if (streamData.emitter) {
            streamData.emitter.end();
        } else {
            streamData.endReadStream = true;
        }
    });

    return stream;
}

module.exports = {
    create: createTLSStream
};
