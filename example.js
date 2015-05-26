var tlsStream = require("./tlsStream");
var streamTrans = require("./streamTransformations");
var Kefir = require("kefir").Kefir;
var procs = require('./procedures');
var cu = require('./connUtils');
var utils = require('./utils');

tlsStream.create("main", 24948, 200)
    .onValue(function (stream) {
        var cm = cu.ConnectionManager(stream);

        cm.getErrEndStream()
            .onEnd(function () {
                console.log("end of connection");
            })
            .onError(function (err) {
                console.error("CM Connection Error: " + err);
            });

        function loopPing() {
            if (cm.isActive()) {
                procs.ping(cm)
                    .onError(function (err) {
                        console.log("ping err: " + err);
                    });
                setTimeout(loopPing, 800);
            } else {
                console.log("Ping stop");
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
    })
    .onError(function (err) {
        console.error("G Connection Error:" + err);
    });
