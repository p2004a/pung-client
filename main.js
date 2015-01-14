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

var ConnectionManager = function (tlsStream) {
    var self = {
        responseStreams: {},
        msgStream: streamTrans.toMessages(tlsStream).endOnError(),
        running: true
    };

    self.msgStream.onError(function () {
        tlsStream.end();
    });

    self.msgStream.onValue(function (val) {
        var resStream = self.responseStreams[val.cSeq];
        if (resStream !== undefined) {
            resStream.emit(val);
        } else if (val.message === "ping") {
            var msg = Message();
            msg.message = "pong";
            msg.sSeq = val.sSeq;
            tlsStream.emit(msg.toString());
        }
    });

    self.msgStream.onEnd(function () {
        self.running = false;
        Object.keys(self.responseStreams).forEach(function (key) {
            self.responseStreams[key].end();
        });
        self.responseStreams = {};
    });

    self.sendMessage = function (msg) {
        var stream = Kefir.emitter();
        stream.cSeq = msg.cSeq;
        stream.unregister = function () {
            self.unregisterResStream(stream.cSeq);
        };
        self.responseStreams[msg.cSeq] = stream;
        tlsStream.emit(msg.toString());
        return stream;
    };

    self.unregisterResStream = function (stream) {
        delete self.responseStreams[stream.cSeq];
    };

    self.getErrEndStream = function () {
        return self.msgStream
            .filter(function () { return false; });
    };

    self.isActive = function () {
        return self.running;
    };

    return self;
};

tlsStream = tlsStream.create("localhost", 24948);
cm = ConnectionManager(tlsStream);

cm.getErrEndStream()
    .onEnd(function () {
        console.log("end of connection");
    })
    .onError(function (err) {
        console.err("Connection Error: " + err);
    });

function ping() {
    if (cm.isActive()) {
        var msg = Message();
        msg.message = "ping";
        var resStream = cm.sendMessage(msg);
        streamTrans.toOneResTimeoutingStream(resStream)
            .onValue(function (val) {
                if (val.message !== "pong") {
                    console.error("wrong reposnse type for ping");
                } else {
                    console.log("pong");
                }
            })
            .onError(function (err) {
                console.log("ping err: " + err);
            });
        setTimeout(ping, 3000);
    }
}
ping();
