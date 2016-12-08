module.exports = function (methodList) {
    // imports inside the packaged function
    var Readable = require('stream').Readable;
    var Promise = require('bluebird');

    function createSocket() {
        return new Promise(function(resolve, reject) {
            // this converts https into wss
            // @todo improve?
            // @todo auto-reconnect, auth, etc
            var bridgeSocket = new WebSocket((window.location + '').replace(/^http/, 'ws').replace(/#.*$/, ''))

            var callCount = 0;
            var callMap = {};
            var remoteReadableMap = Object.create(null);

            function wrapRemoteReadable(streamId) {
                if (remoteReadableMap[streamId]) {
                    throw new Error('stream ID already exists');
                }

                var readableProxy = new Readable({ objectMode: true });
                readableProxy._read = function () {}; // no-op

                // @todo also on error
                readableProxy.once('end', function () {
                    delete remoteReadableMap[streamId];
                });

                remoteReadableMap[streamId] = readableProxy;

                return readableProxy;
            }

            function processSpecialReturnValue(descriptor) {
                var specialType = descriptor[0];

                if (specialType === '>') {
                    var streamId = descriptor[1];

                    return wrapRemoteReadable(streamId);
                }

                throw new Error('unrecognized special value');
            }

            function getSpecialResolver(descriptor) {
                var specialType = descriptor[0];

                if (specialType === '>') {
                    var streamId = descriptor[1];

                    return function (err, eventData) {
                        // @todo handle error
                        var readableProxy = remoteReadableMap[streamId];

                        if (!readableProxy) {
                            return;
                        }

                        readableProxy.push(eventData);
                    };
                }
            }

            bridgeSocket.addEventListener('message', function (e) {
                var data = JSON.parse(e.data);
                var callId = data[0];

                var call = typeof callId === 'number'
                    ? callMap[callId]
                    : getSpecialResolver(callId);

                if (!call) {
                    return;
                }

                if (data.length === 2) {
                    call(null, data[1]);
                } else if (data.length === 4) {
                    call(null, processSpecialReturnValue(data[3]));
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
