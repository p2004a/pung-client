var fs = require('fs');
var NodeRSA = require('node-rsa');
var crypto = require('crypto');

var rsaOptions = {
    environment: 'browser',
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
        key.importKey(der, 'pkcs8-public-der');
        key.setOptions(rsaOptions);
        return key;
    } catch (e) {
        return null;
    }
}

function encrypt(myKey, friendKey, text) {
    try {
        var key = crypto.randomBytes(256 / 8);
        var iv = crypto.randomBytes(128 / 8);
        var cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        cipher.setAutoPadding(true);
        var encrypted = cipher.update(text, 'utf8');
        var encryptedEnd = cipher.final();
        encrypted = Buffer.concat([encrypted, encryptedEnd]);

        return {
            signature: myKey.sign(encrypted, 'base64'),
            message: encrypted.toString('base64'),
            key: friendKey.encrypt(key, 'base64'),
            iv: iv.toString('base64')
        };
    } catch (e) {
        console.error(e);
        return null;
    }
}

function decrypt(myKey, friendKey, data) {
    try {
        var encrypted = new Buffer(data.message, 'base64');
        var iv = new Buffer(data.iv, 'base64');
        var key = myKey.decrypt(new Buffer(data.key, 'base64'), 'buffer');

        if (!friendKey.verify(encrypted, data.signature, 'buffer', 'base64')) {
            throw new Error('signature not valid');
        }

        var decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        var cleartext = decipher.update(encrypted, null, 'utf8');
        cleartext += decipher.final('utf8');

        return cleartext;
    } catch (e) {
        console.error(e);
        return null;
    }
}

module.exports = {
    loadRsaKey: loadRsaKey,
    parseRsaPublic: parseRsaPublic,
    encrypt: encrypt,
    decrypt: decrypt
};
