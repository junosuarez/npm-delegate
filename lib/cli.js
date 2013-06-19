#!/usr/bin/env node
var optimist = require('optimist')
, delegate = require('./delegate')
, http = require('http')
, https = require('https')
, argv = optimist
  .usage('Compose multiple npm registries in fallback order.\nUsage: $0 [opts] host1/registry host2/registry ... hostN/registry')
  .alias('p','port')
    .default('p',5983)
    .describe('p', 'port to listen on')
  .alias('s','secure')
    .default(false)
    .boolean('s')
    .describe('s', 'run the proxy using https?')
  .check(function (argv) {
    if (!argv._.length)
      throw new Error('you must specify at least one registry (two to be useful)')
  })
  .argv;

(argv.secure ? https : http).createServer(delegate(argv._)).listen(argv.port);
console.log("npm-delegate listening on port ", argv.port);
