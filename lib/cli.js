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
  .alias('r','retry')
  .default('r', 0)
  .describe('r', 'retry count in case of timeout')
  .default('timeout',3000)
  .describe('timeout', 'connection timeout')
  .alias('s','secure')
  .boolean('s')
  .default('s', false)
  .describe('s', 'run the proxy using https?')
  .string('proxy')
  .describe('proxy', 'use a proxy for all http requests')
  .boolean('strictssl')
  .default('strictssl', true)
  .describe('strictssl', 'only accept https certificates from known authorities (turn off with no-strictssl)')
  .check(function (argv) {
    if (!argv._.length)
      throw new Error('you must specify at least one registry (two to be useful)')
  })
  .argv;

var proxy = argv.proxy || process.env.http_proxy;

(argv.secure ? https : http).createServer(
  delegate(argv._, proxy, argv.strictssl)
).listen(argv.port);
console.log("npm-delegate listening on port ", argv.port);
