
module.exports = function (methodList) {
    var Promise = require('bluebird');

    function createSocket() {
        return new Promise(function(resolve, reject) {
            // this converts https into wss
            // @todo improve?
            // @todo auto-reconnect, auth, etc
            var bridgeSocket = new WebSocket((window.location + '').replace(/^http/, 'ws').replace(/#.*$/, ''))

            var callCount = 0;
            var callMap = {};

            bridgeSocket.addEventListener('message', function (e) {
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
            }, false);

            function remoteCall(methodName, args) {
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

            bridgeSocket.addEventListener('open', function () {
                resolve(remoteCall);
            }, false);
        });
    }

    return function RemoteControl() {
        var self = this || {};
        var socketPromise = createSocket();

        methodList.forEach(function (methodName) {
            self[methodName] = function () {
                var args = Array.prototype.slice.call(arguments, 0);

                return socketPromise.then(function (remoteCall) {
                    return remoteCall(methodName, args);
                });
            };
        });

        return self; // support non-constructor invocation
    };
};
