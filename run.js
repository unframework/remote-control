
var fs = require('fs');
var express = require('express');

var RemoteControl = require('./index.js');

var app = express();

app.get('/', function(request, response) {
    response.setHeader('Content-Type', 'text/html; charset=UTF-8');
    response.end('<html><head><title>RemoteControl Runner</title></head><body><script src="index.js"></script></body></html>');
});

var server = app.listen(process.env.PORT || 3000);

var rc = new RemoteControl(require('./example/server.js'), server, 'example/index.js');

app.get('/index.js', rc.clientMiddleware);
