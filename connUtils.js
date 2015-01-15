var Kefir = require("kefir").Kefir;
var streamTrans = require("./streamTransformations");

var SeqGen = {
    seq: 0,
    get: function () {
        SeqGen.seq += 1;
        return SeqGen.seq;
    }
};

var Message = function (serverMessage) {
    var self = {
        sSeq: serverMessage ? serverMessage.sSeq : null,
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

    self.close = function () {
        tlsStream.end();
    };

    self.destroy = function () {
        if (self.running) {
            self.running = false;
            Object.keys(self.responseStreams).forEach(function (key) {
                self.responseStreams[key].end();
            });
            self.responseStreams = {};
        }
    };

    self.msgStream.onError(function () {
        self.close();
    });

    self.msgStream.onValue(function (val) {
        var resStream = self.responseStreams[val.cSeq];
        if (resStream !== undefined) {
            resStream.emit(val);
        } else if (val.message === "ping") {
            var msg = Message();
            msg.message = "pong";
            msg.sSeq = val.sSeq;
            var stream = self.sendMessage(msg);
            self.unregisterResStream(stream);
        }
    });

    self.msgStream.onEnd(function () {
        self.destroy();
    });

    return self;
};

module.exports = {
    Message: Message,
    ConnectionManager: ConnectionManager
};