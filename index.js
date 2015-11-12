var stream = require('stream');
var browserify = require('browserify');
var Promise = require('bluebird');
var WebSocketServer = require('ws').Server;
var express = require('express');

var clientConstructorFn = require('./client.js');

var DEFAULT_HOST = '0.0.0.0';
var DEFAULT_PORT = 3000;

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

function whenClientSideCodeReady(exposeName, sourceCode, moduleName) {
    var clientRC = new stream.Readable();
    clientRC._read = function () {};
    clientRC.push(sourceCode);
    clientRC.push(null);

    var b = browserify()
        .exclude(exposeName)
        .require(clientRC, { expose: exposeName, basedir: __dirname })
        .add(moduleName);

    return new Promise(function (resolve, reject) {
        b.bundle(function (err, buffer) {
            if(err) {
                reject(err);
            } else {
                resolve(buffer);
            }
        });
    });
}

function createServer(port, clientMiddleware) {
    var app = express();

    app.get('/', function(request, response) {
        response.setHeader('Content-Type', 'text/html; charset=UTF-8');
        response.end('<html><head><title>RemoteControl Runner</title></head><body><script src="index.js"></script></body></html>');
    });

    app.get('/index.js', clientMiddleware);

    return app.listen(port || DEFAULT_PORT, DEFAULT_HOST);
}

// @todo instantiate methods per connection
module.exports = function RemoteControlServer(constructorOrNamespace, clientModule, port) {
    // @todo filter out "private" methods - anything that starts with _?
    var methodList = Object.keys(typeof constructorOrNamespace === 'function' ? constructorOrNamespace.prototype : constructorOrNamespace);
    var createObject = typeof constructorOrNamespace === 'function'
        ? createConstructorFactory(constructorOrNamespace)
        : createNamespaceFactory(constructorOrNamespace);

    var clientSideCompiledCodeWhenReady = whenClientSideCodeReady(
        '__server', 'module.exports = (' + clientConstructorFn.toString() + ')(' + JSON.stringify(methodList) + ');',
        clientModule ? clientModule : __dirname + '/globalServerStub.js'
    );

    var clientMiddleware = function (req, res) {
        clientSideCompiledCodeWhenReady.then(function (clientSideCompiledCode) {
            res.setHeader('Content-Type', 'application/javascript');
            res.end(clientSideCompiledCode);
        }, function () {
            res.sendStatus(500);
        });
    };

    var httpServer = createServer(port, clientMiddleware);

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
};
