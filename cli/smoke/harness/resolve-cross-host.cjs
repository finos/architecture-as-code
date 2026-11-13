// Loaded into the CLI with NODE_OPTIONS=--require. It resolves the cross-host name to 127.0.0.1,
// because DirectUrlDocumentLoader refuses localhost and *.localhost names.
const dns = require('dns');

const CROSS_HOST = 'smoke-controls.test';
const lookup = dns.lookup;

dns.lookup = function (hostname, ...rest) {
    return lookup.call(this, hostname === CROSS_HOST ? '127.0.0.1' : hostname, ...rest);
};
