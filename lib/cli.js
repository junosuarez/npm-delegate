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
  .alias('t','threshold')
  .default('t', 3000)
  .describe('t', 'connection threshold, when reached, the cluster worker will be recycled')
  .alias('s','secure')
  .boolean('s')
  .default('s', false)
  .describe('s', 'run the proxy using https?')
  .string('proxy')
  .describe('proxy', 'use a proxy for all http requests')
  .boolean('strictssl')
  .default('strictssl', true)
  .describe('strictssl', 'only accept https certificates from known authorities (turn off with no-strictssl)')
  .boolean('cluster')
  .default('cluster', false)
  .describe('cluster', 'use cluster as a runnning platform')
  .check(function (argv) {
    if (!argv._.length)
      throw new Error('you must specify at least one registry (two to be useful)')
  })
  .argv;

var proxy = argv.proxy || process.env.http_proxy;

var server = (argv.secure ? https : http).createServer(
  delegate(argv._, proxy, argv.strictssl)
);

if (argv.cluster) {
  var Cluster = require('cluster2');

  var c = new Cluster({
      port: argv.port,
      connThreshold: argv.thershold || 3000
  });
  c.listen(function(cb) {
      cb(server);
  });
  console.log("Running cluster... ");
}
else {
  server.listen(argv.port);  
}

console.log("npm-delegate listening on port ", argv.port);