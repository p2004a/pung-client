var net = require("net");
var tls = require("tls");
var Kefir = require("kefir").Kefir;

function createTLSStream(hostname, port, timeout) {
    'use strict';
    var timeoutPool = Kefir.pool();

    function setTimeoutErr(message, close_cb) {
        var t = Kefir.later(timeout, message);
        timeoutPool.plug(t);
        t.onValue(close_cb);
        return function () {
            timeoutPool.unplug(t);
            t.offValue(close_cb);
        };
    }

    return Kefir.stream(function (connectedEmitter) {
        function connectionError(err) {
            connectedEmitter.error(err.message);
        }

        var socket = net.connect({
            host: hostname,
            port: port,
            allowHalfOpen: false
        });

        var cancelTCPTimeout = setTimeoutErr("TCP Timeout", function () {
            socket.end();
        });

        socket.setKeepAlive(true, 1000 * 30);

        socket.on('error', connectionError);

        socket.on('connect', function () {
            cancelTCPTimeout();

            var tlsSocket = tls.connect({
                socket: socket,
                rejectUnauthorized: false,
                servername: hostname
            });

            var cancelTLSTimeout = setTimeoutErr("TLS Timeout", function () {
                tlsSocket.end();
            });

            tlsSocket.setEncoding('utf8');

            tlsSocket.on('error', connectionError);

            tlsSocket.on('secureConnect', function () {
                cancelTLSTimeout();

                var stream = Kefir.fromEvents(tlsSocket, 'data')
                    .merge(Kefir.fromEvents(tlsSocket, 'error').valuesToErrors())
                    .takeUntilBy(Kefir.fromEvents(tlsSocket, 'close'));

                stream.emit = function (val) {
                    tlsSocket.write(val, 'utf8');
                };

                stream.end = function () {
                    tlsSocket.end();
                };

                socket.removeListener('error', connectionError);
                tlsSocket.removeListener('error', connectionError);

                connectedEmitter.emit(stream);
            });
        });
    })
    .merge(timeoutPool.valuesToErrors())
    .endOnError()
    .take(1);
}

module.exports = {
    create: createTLSStream
};
