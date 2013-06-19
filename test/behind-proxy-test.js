var mocha = require('mocha')
, should = require('should')
, supertest = require('supertest')
, nock = require('nock')
, delegate = require('../lib/delegate');

describe('npm-delegate', function() {
  describe('with proxy specified', function() {
    var proxyRequests = nock('http://localhost:8080')
      .head('http://registry.npmjs.org:80/thing')
      .reply(404)
      .head('http://someotherregistry:80/thing')
      .reply(200)
      .get('http://someotherregistry:80/thing')
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
    var registryRequests = nock('http://registry.npmjs.org:80')
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
    it('should pick up proxy settings from environment');
    it('should get proxy settings from arguments');
  });
});
