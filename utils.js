var fs = require('fs');
var NodeRSA = require('node-rsa');

function loadRsaKey(path) {
    var keyStr = fs.readFileSync(path);
    return new NodeRSA(keyStr, {
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
}

module.exports = {
    loadRsaKey: loadRsaKey
};
