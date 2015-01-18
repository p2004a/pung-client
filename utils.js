var fs = require('fs');
var NodeRSA = require('node-rsa');

var rsaOptions = {
    environment: 'node',
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
};

function loadRsaKey(path) {
    var keyStr = fs.readFileSync(path);
    return new NodeRSA(keyStr, rsaOptions);
}

function parseRsaPublic(derBase64) {
    try {
        var key = new NodeRSA();
        var der = new Buffer(derBase64, 'base64');
        key.importKey(der, 'pkcs8-public-der', rsaOptions);
        return key;
    } catch (e) {
        return null;
    }
}

module.exports = {
    loadRsaKey: loadRsaKey,
    parseRsaPublic: parseRsaPublic
};
