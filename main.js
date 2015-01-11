var net = require("net");
var tls = require("tls");

var socket = net.connect({
    host: "localhost",
    port: 24948,
    allowHalfOpen: false
}, function () {
    console.log("Connected to " + socket.remoteAddress + ":" + socket.remotePort);

    var cleartextStream = tls.connect({
        socket: socket,
        rejectUnauthorized: false,
        servername: "localhost"
    });

    cleartextStream.setEncoding('utf8');

    cleartextStream.on('data', function(data) {
        console.log(data);
    });

    cleartextStream.on('end', function() {
        console.log("server disconnected");
    });

});
socket.setKeepAlive(true, 1000 * 30);

socket.on('error', function (err) {
    console.error("Error: " + err.message);
    process.exit(1);
});

process.on('uncaughtException', function(err) {
    console.error('Caught uncaught exception: ' + err);
    process.exit(2);
});
