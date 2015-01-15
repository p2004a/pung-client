var tlsStream = require("./tlsStream");
var streamTrans = require("./streamTransformations");
var Kefir = require("kefir").Kefir;
var procs = require('./procedures');
var cu = require('./connUtils');
var utils = require('./utils');

tlsStream = tlsStream.create("localhost", 24948);
cm = cu.ConnectionManager(tlsStream);

cm.getErrEndStream()
    .onEnd(function () {
        console.log("end of connection");
    })
    .onError(function (err) {
        console.error("Connection Error: " + err);
    });

function loopPing() {
    if (cm.isActive()) {
        procs.ping(cm)
            .onError(function (err) {
                console.log("ping err: " + err);
            });
        setTimeout(loopPing, 3000);
    }
}
loopPing(cm);

var rsaKey = utils.loadRsaKey('client.pem');

procs.signup(cm, "testusername", rsaKey)
    .map(function () {
        procs.logout(cm);
    })
    .flatMap(function () {
        return procs.login(cm, "testusername", rsaKey);
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
