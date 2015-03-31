
var browserifyFn = require('browserify-string');
var concat = require('concat-stream');
var Promise = require('bluebird');
var WebSocketServer = require('ws').Server;

var clientConstructorFn = require('./client.js');

function createConstructorFactory(constructor) {
    return function (args) {
        var ctr = constructor.bind.apply(constructor, args);
        return new ctr();
    };
}

function createNamespaceFactory(namespace) {
    return function (args) {
        if (args.length > 0) {
            throw new Error('no arguments expected');
        }

        return namespace;
    };
}

// @todo instantiate methods per connection
module.exports = function RemoteControlServer(constructorOrNamespace, httpServer) {
    var methodList = Object.keys(typeof constructorOrNamespace === 'function' ? constructorOrNamespace.prototype : constructorOrNamespace);
    var createObject = typeof constructorOrNamespace === 'function'
        ? createConstructorFactory(constructorOrNamespace)
        : createNamespaceFactory(constructorOrNamespace);

    var clientSideSourceCode = 'window.RemoteControl = (' + clientConstructorFn.toString() + ')(' + JSON.stringify(methodList) + ');';
    var clientSideCompiledCode = null;

    var self = this;
    browserifyFn(clientSideSourceCode).bundle().pipe(concat(function(js) {
        clientSideCompiledCode = js.toString();
    }));

    var wsServer = new WebSocketServer({ server: httpServer });

    wsServer.on('connection', function (socket) {
        var remoteObject = createObject([]);

        socket.on('message', function (dataJson) {
            var data = null;

            try {
                data = [].concat(JSON.parse(dataJson));
            } catch (e) {
                return;
            }

            var callId = data[0];
            var method = remoteObject[data[1]];
            var args = data.slice(2);
            var result = undefined;

            try {
                result = Promise.resolve(method.apply(remoteObject, args));
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
