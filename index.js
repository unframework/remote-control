
var browserifyFn = require('browserify-string');
var concat = require('concat-stream');
var Promise = require('bluebird');
var WebSocketServer = require('ws').Server;

var clientConstructorFn = require('./client.js');

// @todo instantiate methods per connection
module.exports = function RemoteControlServer(methods, httpServer) {
    var clientSideSourceCode = 'window.RemoteControl = (' + clientConstructorFn.toString() + ')(' + JSON.stringify(Object.keys(methods)) + ');';
    var clientSideCompiledCode = null;

    var self = this;
    browserifyFn(clientSideSourceCode).bundle().pipe(concat(function(js) {
        clientSideCompiledCode = js.toString();
    }));

    var wsServer = new WebSocketServer({ server: httpServer });

    wsServer.on('connection', function (socket) {
        socket.on('message', function (dataJson) {
            var data = null;

            try {
                data = [].concat(JSON.parse(dataJson));
            } catch (e) {
                return;
            }

            var callId = data[0];
            var method = methods[data[1]];
            var args = data.slice(2);
            var result = undefined;

            try {
                result = Promise.resolve(method.apply(null, args));
            } catch (e) {
                result = Promise.reject();
            }

            result.then(function (resultValue) {
                socket.send(JSON.stringify([ callId, resultValue ]));
            }, function (error) {
                console.error(error);
                socket.send(JSON.stringify([ callId, null, true ]));
            });
        });
    });

    this.clientMiddleware = function (req, res) {
        if (!clientSideCompiledCode) {
            throw new Error('client not ready');
        }

        res.setHeader('Content-Type', 'application/javascript');
        res.end(clientSideCompiledCode);
    }
};
