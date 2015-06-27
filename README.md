# remote-control

Call functions on node server from browser web UI for quick prototyping and local deployments. Use promises to get return value.

Server-side code example (`remoteMethods.js`):

```js
module.exports = {
    helloWorld: function (foo, bar) {
        console.log('hey!', foo, 'and', bar);

        return 'baz value';
    }
};
```

Client-side code example (`index.html`):

```html
<script src="remote.js"></script>
<script>
    var server = new RemoteControl();
    server.helloWorld("foo value", "bar value").then(function (baz) {
        console.log("responded with", baz);
    });
</script>
```

Node server example (`index.js`):

```js
var fs = require('fs');
var express = require('express');
var RemoteControl = require('remote-control');

var app = express();

app.get('/', function(request, response) {
    response.setHeader('Content-Type', 'text/html');
    fs.createReadStream(__dirname + '/index.html').pipe(response);
});

var server = app.listen(process.env.PORT || 3000);

var rc = new RemoteControl(require('./remoteMethods.js'), server);
app.get('/remote.js', rc.clientMiddleware)
```
