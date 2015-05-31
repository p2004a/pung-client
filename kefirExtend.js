var Kefir = require('kefir').Kefir;

Kefir.Observable.prototype.apply = function (transformation) {
    return transformation(this);
}
