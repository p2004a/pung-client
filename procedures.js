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

function ping(connectionManager) {
    var msg = cu.Message();
    msg.message = "ping";
    var resStream = connectionManager.sendMessage(msg);
    return streamTrans.toOneResTimeoutingStream(resStream, 500)
        .valuesToErrors(chkMsgType('pong', 0));
}

function verify(connectionManager, rsaKey, stream) {
    return stream
        .valuesToErrors(chkMsgType('decrypt', 1))
        .flatMap(function (val) {
            var msg = cu.Message(val);
            msg.message = "check";
            msg.payload = [rsaKey.decrypt(val.payload[0], 'base64')];
            var resStream = connectionManager.sendMessage(msg);
            return streamTrans.toOneResTimeoutingStream(resStream, 1000);
        })
        .valuesToErrors(chkMsgType('ok', 0));
}

function signup(connectionManager, username, rsaKey) {
    var b64pubkey = rsaKey.exportKey('pkcs8-public-der').toString('base64');

    return verify(connectionManager, rsaKey, Kefir.later(0, 1)
        .flatMap(function () {
            var msg = cu.Message();
            msg.message = "signup";
            msg.payload = [username, b64pubkey];
            var resStream = connectionManager.sendMessage(msg);
            return streamTrans.toOneResTimeoutingStream(resStream, 1000);
        }));
}

function login(connectionManager, username, rsaKey) {
    return verify(connectionManager, rsaKey, Kefir.later(0, 1)
        .flatMap(function () {
            var msg = cu.Message();
            msg.message = "login";
            msg.payload = [username];
            var resStream = connectionManager.sendMessage(msg);
            return streamTrans.toOneResTimeoutingStream(resStream, 1000);
        }));
}

function logout(connectionManager) {
    var msg = cu.Message();
    msg.message = "logout";
    cm.sendMessage(msg).unregister();
    return true;
}

module.exports = {
    ping: ping,
    signup: signup,
    login: login,
    logout: logout
};
