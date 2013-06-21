var mocha = require('mocha')
, should = require('should')
, supertest = require('supertest')
, nock = require('nock')
, child_process = require('child_process')
, path = require('path')
, delegate = require('../lib/delegate');

describe('npm-delegate', function() {
  describe('with proxy specified', function() {
    var proxyRequests = nock('http://localhost:8080')
      .head('http://registry.npmjs.org/thing')
      .reply(404)
      .head('http://someotherregistry/thing')
      .reply(200)
      .get('http://someotherregistry/thing')
      .reply(200, {});

    var server = delegate(
      ['http://registry.npmjs.org/', 'http://someotherregistry/'], 
      'http://localhost:8080'
    );

    it('should use proxy for all requests', function(done) {
      supertest(server)
        .get('/thing')
        .expect(200, function(err) {
          proxyRequests.done();
          done(err);
        });
    });
  });

  describe('with no proxy specified', function() {
    var registryRequests = nock('http://registry.npmjs.org')
      .head('/thing')
      .reply(200)
      .get('/thing')
      .reply(200, {});

    var server = delegate([ 'http://registry.npmjs.org' ]);
   
    it('should not try to use a proxy', function(done) {
      supertest(server)
        .get('/thing')
        .expect(200, function(err) {
          registryRequests.done();
          done(err);
        });
    });
  });

  describe('cli', function() {
    var npmDelegate;

    afterEach(function() {
      if (npmDelegate) {
        npmDelegate.kill();
      }
    });
    
    it('should pick up proxy settings from environment', function(done) {
      var messages = [];
      npmDelegate = child_process.spawn(
        process.execPath,
        [ path.join(__dirname, '../lib/cli.js'), 'http://reg1', 'http://reg2' ],
        {
          env: {
            'http_proxy': 'http://proxy:8080',
            'NODE_DEBUG': 'npm-delegate'
          }
        }
      );
      npmDelegate.stdout.on('data', function(data) {
        messages.push(data.toString());
        if (data.toString().indexOf('npm-delegate listening on port') > -1) {
          messages.should.include('Using proxy:  http://proxy:8080\n');
          done();
        }
      });
    });

    it('should get proxy settings from arguments', function(done) {
      var messages = [];
      npmDelegate = child_process.spawn(
        process.execPath,
        [ 
          path.join(__dirname, '../lib/cli.js'), 
          'http://reg1',
          'http://reg2', 
          '--proxy',
          'http://another-proxy:8080'
        ],
        {
          env: {
            'NODE_DEBUG': 'npm-delegate'
          }
        }
      );
      npmDelegate.stdout.on('data', function(data) {
        messages.push(data.toString());
        if (data.toString().indexOf('npm-delegate listening on port') > -1) {
          messages.should.include('Using proxy:  http://another-proxy:8080\n');
          done();
        }
      });
    });
  });
});
