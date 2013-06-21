var mocha = require('mocha')
, should = require('should')
, child_process = require('child_process')
, path = require('path')
, delegate = require('../lib/delegate');

describe('npm-delegate', function() {
  describe('with no_strict_ssl option', function() {
    /* can't quite work out how best to test this 
     * - could use sandboxed-module to load fake request module
     */
    it('should pass the strictSSL:false option to request');
  });

  describe('cli', function() {
    var npmDelegate;

    afterEach(function() {
      if (npmDelegate) {
        npmDelegate.kill();
      }
    });

    it('should get no-strict-ssl option from arguments', function(done) {
      var messages = [];
      npmDelegate = child_process.spawn(
        process.execPath,
        [ path.join(__dirname, '../lib/cli.js'), '--no-strictssl', 'http://reg1', 'http://reg2' ],
        {
          env: {
            'NODE_DEBUG': 'npm-delegate'
          }
        }
      );
      npmDelegate.stdout.on('data', function(data) {
        messages.push(data.toString());
        if (data.toString().indexOf('npm-delegate listening on port') > -1) {
          messages.should.include('Strict SSL turned OFF - will accept any certificate.\n');
          done();
        }
      });
    });
  });
});
