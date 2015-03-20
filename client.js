
module.exports = function (methodList) {
    var Promise = require('bluebird');

    function createSocket(onMessage) {
        return new Promise(function(resolve, reject) {
            // this converts https into wss
            // @todo improve?
            // @todo auto-reconnect, auth, etc
            var bridgeSocket = new WebSocket((window.location + '').replace(/^http/, 'ws').replace(/#.*$/, ''))

            bridgeSocket.onopen = function () {
                resolve(bridgeSocket);
            };

            bridgeSocket.onmessage = onMessage;
        });
    }

    var callCount = 0;
    var callMap = {};

    var socketPromise = createSocket(function (e) {
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
    });

    function remoteCall(bridgeSocket, methodName, args) {
        return new Promise(function(resolve, reject) {
            var callId = callCount,
                timeoutId = null;

            callCount += 1;

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

    methodList.forEach(function (methodName) {
        methodMap[methodName] = function () {
            var args = Array.prototype.slice.call(arguments, 0);

            return socketPromise.then(function (socket) {
                return remoteCall(socket, methodName, args);
            });
        };
    });

    return methodMap;
};
