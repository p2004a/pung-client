var Kefir = require("kefir").Kefir;
var streamTrans = require("./streamTransformations");
var cu = require('./connUtils');

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

function sendOneResMsg(cm, timeout, msg) {
    var resStream = cm.sendMessage(msg);
    return streamTrans.toOneResTimeoutingStream(resStream, timeout);
}

function ping(cm) {
    var msg = cu.Message(null, "ping");
    var resStream = cm.sendMessage(msg);
    return streamTrans.toOneResTimeoutingStream(resStream, 500)
        .valuesToErrors(chkMsgType('pong', 0));
}

function verify(cm, rsaKey, stream) {
    return stream
        .valuesToErrors(chkMsgType('decrypt', 1))
        .flatMap(function (val) {
            var msg = cu.Message(val, "check", rsaKey.decrypt(val.payload[0], 'base64'));
            return sendOneResMsg(cm, 700, msg);
        })
        .valuesToErrors(chkMsgType('ok', 0));
}

function signup(cm, username, rsaKey) {
    var b64pubkey = rsaKey.exportKey('pkcs8-public-der').toString('base64');

    return verify(cm, rsaKey, Kefir.later(0, 1)
        .flatMap(function () {
            var msg = cu.Message(null, "signup", username, b64pubkey);
            return sendOneResMsg(cm, 700, msg);
        }));
}

function login(cm, username, rsaKey) {
    return verify(cm, rsaKey, Kefir.later(0, 1)
        .flatMap(function () {
            var msg = cu.Message(null, "login", username);
            return sendOneResMsg(cm, 700, msg);
        }));
}

function logout(cm) {
    var msg = cu.Message(null, "logout");
    cm.sendFAFMessage(msg);
    return true;
}

module.exports = {
    ping: ping,
    signup: signup,
    login: login,
    logout: logout
};
