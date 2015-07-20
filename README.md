# remote-control

Call functions on NodeJS server directly from client-side code in the browser UI for quick prototyping and local deployments. Use promises to get return value.

If you are quickly prototyping a new app with both in-browser and server-side components, the last thing you want to worry about is setting up Express routes, the main entry-point HTML file, encoding/decoding values, dealing with XHR... This module is designed to help get going without all the boilerplate, as just a simple live "tunnel" between the browser and server worlds.

The easiest way to get started is to just install as a global utility:

```sh
npm install -g remote-control
```

Then put client-side in `index.js`:

```js
var server = require('__server')(); // Browserified by default, but that's optional

server.helloWorld('foo value', 'bar value').then(function (baz) {
    document.body.appendChild(
        document.createTextNode('responded with: ' + baz)
    );
});
```

And server-side code in `server.js`:

```js
module.exports = {
    helloWorld: function (foo, bar) {
        console.log('invoked helloWorld with', foo, 'and', bar);

        return 'baz value';
    }
};
```

Then run:

```sh
remote-control server.js index.js
```

And open http://localhost:3000/ in your browser. That's it!

The `remote-control` utility is a sandbox development server. It automatically [browserifies](http://browserify.org/) the client-side code and presents it to the browser inside a ready-made page. It works much like the excellent [Beefy](http://didact.us/beefy/) runner, but adds the necessary plumbing to directly call functions server-side.

## To Do

* document Express middleware mode
* implement connection restart
* implement support for returning EventEmitters (server push!)
* allow auto-reloading code
* add code checksumming?
