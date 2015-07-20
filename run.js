#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var express = require('express');
var minimist = require('minimist');

var RemoteControl = require('./index.js');

var argv = require('minimist')(process.argv.slice(2));

if (argv._.length !== 2) {
    throw new Error('need two arguments: server module and client module');
}

var serverModulePath = path.resolve(argv._[0]);
var clientModulePath = path.resolve(argv._[1]);
var host = '0.0.0.0';
var port = argv.port || 3000;

var app = express();

app.get('/', function(request, response) {
    response.setHeader('Content-Type', 'text/html; charset=UTF-8');
    response.end('<html><head><title>RemoteControl Runner</title></head><body><script src="index.js"></script></body></html>');
});

var server = app.listen(port, host);

var rc = new RemoteControl(require(serverModulePath), server, clientModulePath);

app.get('/index.js', rc.clientMiddleware);

console.info('RemoteControl runner listening on ' + host + ':' + port);
