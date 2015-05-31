require('./kefirExtend');
var Kefir = require("kefir").Kefir;
var st = require("./streamTransformations");
var cu = require('./connUtils');

function checkMessageType(type, payloadSize) {
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

function ping(cm) {
    var msg = cu.Message(null, "ping");
    return cm.sendMessage(msg, {responses: 1})
        .apply(st.timeout(500))
        .valuesToErrors(checkMessageType('pong', 0));
}

// stream transformation performing verification
function verify(cm, rsaKey) {
    return stream => stream
        .apply(st.timeout(700))
        .valuesToErrors(checkMessageType('decrypt', 1))
        .flatMap(val => {
            var res = "YXNkZg==";
            try {
                res = rsaKey.decrypt(val.payload[0], 'base64');
            } catch(e) {} // wrong res
            var msg = cu.Message(val, "check", res);
            return cm.sendMessage(msg, {responses: 1});
        })
        .apply(st.timeout(700))
        .valuesToErrors(checkMessageType('ok', 0));
}

function signup(cm, username, rsaKey) {
    var b64pubkey = rsaKey.exportKey('pkcs8-public-der').toString('base64');
    var msg = cu.Message(null, "signup", username, b64pubkey);
    return cm.sendMessage(msg, {responses: 1})
        .apply(verify(cm, rsaKey))
}

function login(cm, username, rsaKey) {
    var msg = cu.Message(null, "login", username);
    return cm.sendMessage(msg, {responses: 1})
        .apply(verify(cm, rsaKey))
}

function logout(cm) {
    var msg = cu.Message(null, "logout");
    cm.sendMessage(msg, {responses: 0});
}

function addFriend(cm, username) {
    var msg = cu.Message(null, "add_friend", username);
    return cm.sendMessage(msg, {responses: 1})
        .apply(st.timeout(3000))
        .valuesToErrors(checkMessageType('ok', 0));
}

function getFriends(cm) {
    var msg = cu.Message(null, "get_friends");
    return cm.sendMessage(msg, {responses: Infinity})
        .valuesToErrors(checkMessageType('friend', 2));
}

function getMessages(cm) {
    var msg = cu.Message(null, "get_messages");
    return cm.sendMessage(msg, {responses: Infinity})
        .valuesToErrors(checkMessageType('message', 5));
}

function getFriendRequests(cm) {
    var msg = cu.Message(null, "get_friend_requests");
    return cm.sendMessage(msg, {responses: Infinity})
        .valuesToErrors(checkMessageType('friend_request', 1));
}

function sendMessage(cm, to, data) {
    var msg = cu.Message(null, "send_message", to,
                        data.message,
                        data.signature,
                        data.key,
                        data.iv);
    return cm.sendMessage(msg, {responses: 1})
        .apply(st.timeout(5000))
        .valuesToErrors(checkMessageType('ok', 0));
}

module.exports = {
    ping: ping,
    signup: signup,
    login: login,
    logout: logout,
    addFriend: addFriend,
    getFriends: getFriends,
    getMessages: getMessages,
    getFriendRequests: getFriendRequests,
    sendMessage: sendMessage
};
