var Kefir = require("kefir").Kefir;
var streamTrans = require("./streamTransformations");

var SeqGen = {
    seq: 0,
    get: function () {
        SeqGen.seq += 1;
        return SeqGen.seq;
    }
};

var Message = function (serverMessage, message) {
    var self = {
        sSeq: serverMessage ? serverMessage.sSeq : null,
        cSeq: SeqGen.get(),
        payload: [],
        message: message ? message : ""
    };

    for (var i = 2; i < arguments.length; i += 1) {
        self.payload.push(arguments[i]);
    }

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
        responseEmitters: {},
        msgStream: streamTrans.toMessages(tlsStream).endOnError(),
        running: true
    };

    self.sendMessage = function (msg, dontGetConnectionErrors) {
        var stream = Kefir.stream(function (emitter) {
            self.responseEmitters[msg.cSeq] = emitter;
            return function () {
                delete self.responseEmitters[msg.cSeq];
            }
        });
        stream.cSeq = msg.cSeq;
        stream.dontGetConnectionErrors = dontGetConnectionErrors || false;
        stream.unregister = function () {
            self.unregisterResStream(stream);
        };
        tlsStream.emit(msg.toString());
        return stream;
    };

    self.sendFAFMessage = function (msg) {
        tlsStream.emit(msg.toString());
    };

    self.unregisterResStream = function (stream) {
        delete self.responseEmitters[stream.cSeq];
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

    self.destroy = function (error) {
        if (self.running) {
            self.running = false;
            Object.keys(self.responseEmitters).forEach(function (key) {
                if (error && !self.responseEmitters[key].dontGetConnectionErrors) {
                    self.responseEmitters[key].error(error);
                }
                self.responseEmitters[key].end();
            });
            self.responseEmitters = {};
        }
    };

    self.msgStream.onError(function (err) {
        self.destroy(err);
        self.close();
    });

    self.msgStream.onValue(function (val) {
        var resEmitter = self.responseEmitters[val.cSeq];
        if (resEmitter !== undefined) {
            resEmitter.emit(val);
        } else if (val.message === "ping") {
            self.sendFAFMessage(Message(val, "pong"));
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
