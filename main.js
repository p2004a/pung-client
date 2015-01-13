var tlsStream = require("./tlsStream");

process.on('uncaughtException', function(err) {
    console.error('Caught uncaught exception: ' + err);
    process.exit(2);
});

stream = tlsStream.create("localhost", 24948);

stream.onValue(function (val) {
    console.log(val);
});

stream.onError(function (err) {
    console.error(err);
});

stream.onEnd(function () {
    console.log("End of connection");
});
