
var browserifyFn = require('browserify-string');
var concat = require('concat-stream');
var Promise = require('bluebird');
var WebSocketServer = require('ws').Server;

var clientConstructorFn = function (methodList) {
    var Promise = require('bluebird');

    // this converts https into wss
    // @todo improve?
    // @todo auto-reconnect, auth, etc
    var bridgeSocket = new WebSocket((window.location + '').replace(/^http/, 'ws').replace(/#.*$/, ''))

    var callMap = {};

    bridgeSocket.onmessage = function (e) {
        var data = JSON.parse(e.data);
        var call = callMap[data[0]];

        if (!call) {
            return;
        }

        if (data.length === 2) {
            call(null, data[1]);
        } else {
            call(data[2]);
        }
    };

    callMap = {};

    function remoteCall(methodName) {
        var args = Array.prototype.slice.call(arguments, 1);

        return new Promise(function(resolve, reject) {
            var callId = Math.random() + '',
                timeoutId = null;

            function cleanup() {
                window.clearTimeout(timeoutId);
                delete callMap[callId];
            };

            timeoutId = window.setTimeout(function() {
                cleanup();
                reject();
            }, 5000);

            callMap[callId] = function (error) {
                cleanup();

                if (arguments.length === 2) {
                    resolve(arguments[1]);
                } else {
                    reject(error);
                }
            };

            bridgeSocket.send(JSON.stringify([callId, methodName].concat(args)));
        });
    }

    var methodMap = {};

    methodList.forEach(function (v) {
        methodMap[v] = remoteCall.bind(null, v);
    });

    return methodMap;
}

// @todo instantiate methods per connection
module.exports = function RpcServer(methods, httpServer) {
    var clientSideSourceCode = 'window.server = (' + clientConstructorFn.toString() + ')(' + JSON.stringify(Object.keys(methods)) + ');';

    var self = this;
    browserifyFn(clientSideSourceCode).bundle().pipe(concat(function(js) {
        // @todo use Express middleware instead
        self.clientSideCode = js.toString();
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
};
