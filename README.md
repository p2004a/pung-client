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

Just type

    npm start

and the client window will show up.


Notes
-----

Currently client doesn't support creating RSA keys so to signup/login to server
using client you have to prepare them on your own for example using openssl:

    openssl genrsa -out mykey.pem 1024
