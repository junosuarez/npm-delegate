var fallback = require('fallback')
, request = require('request')
, path = require('path')
, url = require('url2');

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

module.exports = function setup(registryUrls, proxy) {
  var registries = registryUrls.map(parseRegistry);

  if (proxy) {
    debug("Using proxy: ", proxy);
    request.defaults({ proxy: proxy });
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
      forwardReq(req, proxy), 
      function (err, resIn, registry) {
        if (err) {
          debug("Err was ", err);
          resOut.write(JSON.stringify({error: 'There was an error resolving your request:\n' + JSON.stringify(err, null, 2)}))
          return resOut.end()
        }
        else if (!resIn) {
          resOut.statusCode = 400
          resOut.write(JSON.stringify({error: 'request could not be fulfilled by any of the registries on this proxy.'
                                       + 'perhaps the module you\'re looking for does not exist'}))
          resOut.end()
        } else {
          debug('proxying response from registry ', url.format(registry))
          debug("setting header");
          resOut.setHeader('x-registry', url.format(registry))
          debug("piping to output");
          resIn.pipe(resOut);
        }
    });
    
  };
};

function forwardReq(request, proxy) {
  return function(registry, cb) {
    forward(request, registry, proxy, cb);
  }
}

function forward(reqIn, registry, proxy, cb) {
  var reqOut = {
    protocol: registry.protocol
    , hostname: registry.hostname
    , port: registry.port
    , path: rebase(registry.path, reqIn.url)
  };
  
  debug('fwd req', reqOut)

  lookBeforeYouLeap(
    { 
      url: url.format(reqOut), 
      method: reqIn.method, 
      headers: reqIn.headers, 
      auth: registry.auth,
      proxy: proxy
    }, 
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

  parsed.port = parsed.port || 80;

  return parsed;
}
