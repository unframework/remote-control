#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var minimist = require('minimist');

var RemoteControl = require('./index.js');

var argv = require('minimist')(process.argv.slice(2));

if (argv._.length !== 2) {
    throw new Error('need two arguments: server module and client module');
}

var serverModulePath = path.resolve(argv._[0]);
var clientModulePath = path.resolve(argv._[1]);
var port = argv.port;

var rc = new RemoteControl(require(serverModulePath), clientModulePath, port);

console.info('RemoteControl runner listening on port ' + (port || 3000));
