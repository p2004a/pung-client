var tlsStream = require("./tlsStream");
var streamTrans = require("./streamTransformations");
var Kefir = require("kefir").Kefir;
var NodeRSA = require('node-rsa');
var fs = require('fs');
var procs = require('./procedures');
var cu = require('./connUtils');

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

procs.signup(cm, "testusername", rsaKey)
    .map(procs.logout)
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
