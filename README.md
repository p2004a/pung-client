Pung client
===========

Client of the Pung - secure, encrypted chat.

Build
-----

To build client you need [npm](https://www.npmjs.com/) (bundled with
[Node.js](http://nodejs.org/)) and [bower](http://bower.io/).

After cloning repository run

    npm install
    bower install

and you are done.

Running
-------

Client is using [node-webkit](https://github.com/nwjs/nw.js/tree/master) as
runtime. While development I was using version v0.11.5.

To run client execute `nw` with path to directory containing client as first
argument.

Project is configured for development. After starting client you will see
toolbar. To hide it set `window/toolbar` to `false` in `package.json`.

Notes
-----

Currently client doesn't support creating RSA keys so to signup/login to server
using client you have to prepare them on your own for example using openssl:

    openssl genrsa -out mykey.pem 1024
