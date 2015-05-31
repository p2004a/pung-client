var Kefir = require("kefir").Kefir;
var streamTrans = require("./streamTransformations");

var SeqGen = function (start) {
    var self = {
        _seq: start || 1
    };

    self.get = function () {
        var res = self._seq;
        self._seq += 1;
        return res;
    };

    return self;
}

var MessageSeqGen = SeqGen(1);

var Message = function (serverMessage, message) {
    var self = {
        sSeq: serverMessage ? serverMessage.sSeq : null,
        cSeq: MessageSeqGen.get(),
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
        _responseHandlers: {},
        _msgStream: streamTrans.toMessages(tlsStream).endOnError(),
        _running: true
    };

    self.sendMessage = function (msg, userOptions) {
        var options = {
            connection_errors: true,
            responses: Infinity,
        };

        Object.keys(options).forEach(key => {
            if (key in userOptions) {
                options[key] = userOptions[key];
            }
        });

        tlsStream.emit(msg.toString());

        if (options.responses > 0) {
            self._responseHandlers[msg.cSeq] = {
                options: options,
                response_count: 0,
                emitter: null,
                cSeq: msg.cSeq
            };

            var stream = Kefir.stream(emitter => {
                self._responseHandlers[msg.cSeq].emitter = emitter;
                return () => self._responseHandlers[msg.cSeq].emitter = null;
            });

            return stream;
        } else {
            return null;
        }
    };

    self.unregister = function (cSeq) {
        if (self._responseHandlers[cSeq].emitter) {
            self._responseHandlers[cSeq].emitter.end();
        }
        delete self._responseHandlers[cSeq];
    };

    self.getErrEndStream = function () {
        return self._msgStream.filter(() => false);
    };

    self.isActive = function () {
        return self._running;
    };

    self.close = function () {
        tlsStream.end();
    };

    self.destroy = function (error) {
        if (self._running) {
            self._running = false;
            Object.keys(self._responseHandlers).forEach(function (key) {
                if (error && self._responseHandlers[key].options.connection_errors && self._responseHandlers[key].emitter) {
                    self._responseHandlers[key].emitter.error(error);
                }
                // check because handler of error could remove it already:
                if (key in self._responseHandlers) {
                    if (self._responseHandlers[key].emitter) {
                        self._responseHandlers[key].emitter.end();
                    }
                }
            });
            self._responseHandlers = {};
        }
    };

    self._msgStream.onError(function (err) {
        self.destroy(err);
        self.close();
    });

    self._msgStream.onValue(function (val) {
        var handler = self._responseHandlers[val.cSeq];
        if (handler !== undefined) {
            handler.response_count += 1;
            if (handler.emitter) {
                handler.emitter.emit(val);
            }
            if (handler.response_count >= handler.options.responses) {
                if (handler.emitter) {
                    handler.emitter.end();
                }
                if (self._responseHandlers[handler.cSeq]) {
                    delete self._responseHandlers[handler.cSeq];
                }
            }
        } else if (val.message === "ping") {
            self.sendMessage(Message(val, "pong"), {responses: 0});
        } else {
            console.warn("WARN: Unexpected message from server: ", val);
        }
    });

    self._msgStream.onEnd(function () {
        self.destroy();
    });

    return self;
};

module.exports = {
    Message: Message,
    ConnectionManager: ConnectionManager
};
