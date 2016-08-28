module.exports = function (methodList) {
    // imports inside the packaged function
    var EventEmitter = require('events').EventEmitter;
    var Promise = require('bluebird');

    function createSocket() {
        return new Promise(function(resolve, reject) {
            // this converts https into wss
            // @todo improve?
            // @todo auto-reconnect, auth, etc
            var bridgeSocket = new WebSocket((window.location + '').replace(/^http/, 'ws').replace(/#.*$/, ''))

            var callCount = 0;
            var callMap = {};
            var emitterMap = Object.create(null);

            function wrapEmitter(emitterId) {
                if (emitterMap[emitterId]) {
                    throw new Error('emitter ID already exists');
                }

                var emitter = new EventEmitter();

                // @todo also on error
                emitter.once('end', function () {
                    delete emitterMap[emitterId];
                });

                emitterMap[emitterId] = emitter;

                return emitter;
            }

            bridgeSocket.addEventListener('message', function (e) {
                var data = JSON.parse(e.data);
                var callId = data[0];

                var call = typeof callId === 'number'
                    ? callMap[callId]
                    : function (err, eventData) {
                        var emitterId = callId[0];
                        var emitter = emitterMap[emitterId];

                        if (!emitter) {
                            return;
                        }

                        emitter.emit.apply(emitter, eventData);
                    };

                if (!call) {
                    return;
                }

                if (data.length === 2) {
                    call(null, data[1]);
                } else if (data.length === 4) {
                    call(null, wrapEmitter(data[3]));
                } else {
                    // reconstruct safe error data
                    var error = new Error();
                    error.name = data[2][0];
                    error.message = data[2][1];

                    call(error);
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
