var fallback = require('fallback')
var request = require('request')
var path = require('path')
var url = require('url2')

function debug() {
  if (/npm-delegate/.test(process.env['NODE_DEBUG'])) {
    console.log.apply(console, arguments);
    debug = function() {
      console.log.apply(console, arguments);
    };
  } else {
    debug = function() {};
  }
}

module.exports = function setup(registryUrls, proxy, strictSSL, options) {
  var registries = registryUrls.map(parseRegistry);

  options = options || {};
  if (proxy) {
    debug("Using proxy: ", proxy);
  }

  if (!strictSSL) {
    debug('Strict SSL turned OFF - will accept any certificate.');
  }

  debug("Registries: ", registries.map(url.format));

  return function delegate(req, resOut) {

    if (req.method !== 'GET') {
      debug('invalid method')
      resOut.statusCode = 405
      resOut.write(JSON.stringify({error: 'invalid method'}))
      resOut.end()
      return
    }

    fallback(
      registries, 
      forwardReq(req, proxy, strictSSL, options), 
      function (err, resIn, registry) {
        if (err) {
          debug("Err was ", err);
          resOut.write(
            JSON.stringify({
              error: 'There was an error resolving your request:\n' + JSON.stringify(err, null, 2)
            })
          )
          return resOut.end()
        }
        else if (!resIn) {
          resOut.statusCode = 400
          resOut.write(
            JSON.stringify({
              error: 'request could not be fulfilled by any of the registries on this proxy.'
                + 'perhaps the module you\'re looking for does not exist'
            })
          )
          resOut.end()
        } else {
          debug('proxying response from registry ', url.format(registry))
          debug("setting header");
          resOut.setHeader('x-registry', url.format(registry))
          debug("piping to output");

          resIn.pipe(resOut);
          resIn.on('error', function(err) {
            resOut.statusCode = 400
            resOut.write(
              JSON.stringify({
                error: 'There was an error resolving your request:\n' + JSON.stringify(err, null, 2)
              })
            )
            //resOut.connection.destroy();
            resOut.destroy();
            debug('Got error during streaming: ' + (err.stack || err));
          });
        }
    });
    
  };
};

function forwardReq(request, proxy, strictSSL, options) {
  return function(registry, cb) {
    forward(request, registry, proxy, strictSSL, options, cb);
  }
}

function forward(reqIn, registry, proxy, strictSSL, options, cb) {
  var reqOut = {
    protocol: registry.protocol
    , hostname: registry.hostname
    , port: registry.port
    , path: rebase(registry.path, reqIn.url)
  };
  
  debug('fwd req', reqOut)

  reqIn.headers.target = reqIn.headers.host;
  delete reqIn.headers.host;
  delete reqIn.headers.authorization;

  var params = { 
      url: url.format(reqOut), 
      method: reqIn.method, 
      headers: reqIn.headers, 
      auth: registry.auth,
      proxy: proxy,
      strictSSL: strictSSL,
      timeout: options.timeout || 30000,
      retry: options.retry || 0,
      retryCount: 0
    };

  lookBeforeYouLeap(
    params, 
    function (err, res) {
      if (err) {
        debug("Error talking to %s, was: ", registry.hostname, err);
        return cb();
      }
        
      if (res && res.statusCode >= 400) {
        debug(
          "Registry %s responded with %d for %s", 
          registry.hostname, 
          res.statusCode, 
          reqOut.path
        );
        return cb();
      }

      return cb(null, res);
    }
  );
}

function lookBeforeYouLeap(params, cb) {
  //do a HEAD request first
  params.method = "HEAD";
  request(params, function(err, res) {
    debug("HEAD %s returned %d", params.url, res && res.statusCode);
    //nothing useful
    if (err || (res && res.statusCode >= 400)) {
        
      if (err && /TIMEDOUT$/.test(err.code) 
          && params.retryCount++ <= params.retry) {
  
          debug("Got timeout will retry for: " + params.url);
          // retry
          process.nextTick(function() {
            lookBeforeYouLeap(params, cb);
          });
          return;
      }

      return cb(err, res);
    }
    //we've got a useful response
    //make a get request
    debug("GET ", params.url);
    params.method = "GET"; 
    return cb(null, request(params));
  });
}

function rebase(pathBase, pathExtra) {
  debug(pathBase, pathExtra);
  return path.join(pathBase, pathExtra);
}

function isNotHttp(protocol) {
  return "http:" !== protocol && "https:" !== protocol;
}

function parseRegistry(string) {
  var parsed = url.parse(string)
  if (isNotHttp(parsed.protocol)) {
    throw new Error('invalid registry address: specify a protocol (eg https://): ' + string);
  }

  return parsed;
}
