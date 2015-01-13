var tlsStream = require("./tlsStream");
var streamTrans = require("./streamTransformations");
var Kefir = require("kefir").Kefir;

tlsStream = tlsStream.create("localhost", 24948);
msgStream = streamTrans.toMessages(tlsStream);

msgStream.onError(function (err) {
    console.error("Error: " + err);
    tlsStream.end();
});

msgStream.onEnd(function () {
    console.log("End of connection");
});

msgStream.onValue(function (val) {
    console.log("line: ", val);
});
