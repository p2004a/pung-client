var tlsStream = require("./tlsStream");
var streamTrans = require("./streamTransformations");
var Kefir = require("kefir").Kefir;

process.on('uncaughtException', function(err) {
    console.error('Caught uncaught exception: ' + err);
    process.exit(2);
});

stream = tlsStream.create("localhost", 24948);
stream = streamTrans.toLineStream(stream);
stream = streamTrans.group(stream, 2);

stream.onError(function (err) {
    console.error("Error: " + err);
    stream.end();
});

stream.onEnd(function () {
    console.log("End of connection");
});

stream.onValue(function (val) {
    console.log("line: ", val);
});
