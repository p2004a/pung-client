var tlsStream = require("./tlsStream");
var streamTrans = require("./streamTransformations");
var Kefir = require("kefir").Kefir;
var NodeRSA = require('node-rsa');
var fs = require('fs');

var SeqGen = {
    seq: 0,
    get: function () {
        SeqGen.seq += 1;
        return SeqGen.seq;
    }
};

var Message = function (serverMessage) {
    var self = {
        sSeq: serverMessage !== undefined ? serverMessage.sSeq : null,
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

tlsStream = tlsStream.create("localhost", 24948);
cm = ConnectionManager(tlsStream);

cm.getErrEndStream()
    .onEnd(function () {
        console.log("end of connection");
    })
    .onError(function (err) {
        console.error("Connection Error: " + err);
    });

function ping(connectionManager) {
    if (connectionManager.isActive()) {
        var msg = Message();
        msg.message = "ping";
        var resStream = connectionManager.sendMessage(msg);
        streamTrans.toOneResTimeoutingStream(resStream, 500)
            .onValue(function (val) {
                if (val.message !== "pong") {
                    console.error("wrong reposnse type for ping");
                }
            })
            .onError(function (err) {
                console.log("ping err: " + err);
            });
        setTimeout(function () {
            ping(connectionManager);
        }, 3000);
    }
}
ping(cm);

function chkMsgType(type, payloadSize) {
    return function (msg) {
        if (msg.message === 'error' && msg.payload.length === 1) {
            return {
                 convert: true,
                 error: "error from server: " + new Buffer(msg.payload[0], 'base64').toString('utf8')
             };
        } else if (msg.message !== type || msg.payload.length !== payloadSize) {
            return {convert: true, error: "wrong return message: " + msg.message};
        }
        return {convert: false, error: null};
    };
}

function signup(connectionManager, username, rsaKey) {
    var b64pubkey = rsaKey.exportKey('pkcs8-public-der').toString('base64');

    return Kefir.later(0, 1)
        .flatMap(function () {
            console.log("sending singup");
            var msg = Message();
            msg.message = "signup";
            msg.payload = [username, b64pubkey];
            var resStream = connectionManager.sendMessage(msg);
            return streamTrans.toOneResTimeoutingStream(resStream, 1000);
        })
        .valuesToErrors(chkMsgType('decrypt', 1))
        .flatMap(function (val) {
            console.log("sending check");
            var msg = Message(val);
            msg.message = "check";
            msg.payload = [rsaKey.decrypt(val.payload[0], 'base64')];
            var resStream = connectionManager.sendMessage(msg);
            return streamTrans.toOneResTimeoutingStream(resStream, 1000);
        })
        .valuesToErrors(chkMsgType('ok', 0));
}

function login(connectionManager, username, rsaKey) {
    return Kefir.later(0, 1)
        .flatMap(function () {
            console.log("sending login");
            var msg = Message();
            msg.message = "login";
            msg.payload = [username];
            var resStream = connectionManager.sendMessage(msg);
            return streamTrans.toOneResTimeoutingStream(resStream, 1000);
        })
        .valuesToErrors(chkMsgType('decrypt', 1))
        .flatMap(function (val) {
            console.log("sending check");
            var msg = Message(val);
            msg.message = "check";
            msg.payload = [rsaKey.decrypt(val.payload[0], 'base64')];
            var resStream = connectionManager.sendMessage(msg);
            return streamTrans.toOneResTimeoutingStream(resStream, 1000);
        })
        .valuesToErrors(chkMsgType('ok', 0));
}

var keyStr = fs.readFileSync('client.pem');
var rsaKey = new NodeRSA(keyStr, {
  encryptionScheme: {
    scheme: 'pkcs1_oaep',
    hash: 'sha256',
    label: new Buffer("verification", "utf8")
  },
  signingScheme: {
    scheme: 'pss',
    hash: 'sha256',
    saltLength: 20
  }
});

signup(cm, "testusername", rsaKey)
    .map(function (val) {
        var msg = Message(val);
        msg.message = "logout";
        cm.sendMessage(msg).unregister();
        return true;
    })
    .flatMap(function () {
        return login(cm, "testusername", rsaKey);
    })
    .onError(function (err) {
        console.error("error: ", err);
    })
    .onValue(function (val) {
        console.log("success! : ", val.message);
    })
    .onEnd(function () {
        console.log("end of procedure");
    });
