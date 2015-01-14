var tlsStream = require("./tlsStream");
var streamTrans = require("./streamTransformations");
var Kefir = require("kefir").Kefir;

var SeqGen = {
    seq: 0,
    get: function () {
        SeqGen.seq += 1;
        return SeqGen.seq;
    }
};

var Message = function () {
    var self = {
        sSeq: null,
        cSeq: SeqGen.get(),
        payload: [],
        message: ""
    };

    self.toString = function () {
        var res = "c" + self.cSeq + " ";
        if (self.sSeq !== null) {
            res += "s" + self.sSeq + " ";
        }
        res += self.message + "\n";
        res += self.payload.join(' ') + "\n";
        return res;
    };

    return self;
};

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

setInterval(function () {
    var msg = Message();
    msg.message = "ping";
    tlsStream.emit(msg.toString());
}, 3000);
