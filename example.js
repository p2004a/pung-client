var tlsStream = require("./tlsStream");
var streamTrans = require("./streamTransformations");
var Kefir = require("kefir").Kefir;
var procs = require('./procedures');
var cu = require('./connUtils');
var utils = require('./utils');

tlsStream.create("main", 24948, 200)
    .onValue(stream => {
        var cm = cu.ConnectionManager(stream);

        cm.getErrEndStream()
            .onEnd(() => console.log("end of connection"))
            .onError(err => console.error("CM Connection Error: " + err));

        function loopPing() {
            if (cm.isActive()) {
                procs.ping(cm)
                    .onError(err => console.log("ping err: " +err));
                setTimeout(loopPing, 800);
            } else console.log("Ping stop");
        }
        loopPing(cm);

        var rsaKey = utils.loadRsaKey('client.pem');

        procs.signup(cm, "testusername", rsaKey)
            .onValue(() => procs.logout(cm))
            .flatMap(() => procs.login(cm, "testusername", rsaKey))
            .onError(err => console.error("error: ", err))
            .onValue(val => console.log("success! : ", val.message))
            .onEnd(() => console.log("end of procedure"));
    })
    .onError(err => console.error("G Connection Error:" + err));
