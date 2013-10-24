var http = require('http')
, should = require('should')
, child_process = require('child_process')
, path = require('path')
, request = require('request')
, path = require('path')
, delegate = require('../lib/delegate');

describe('npm-delegate negative', function() {
	
	process.env['NODE_DEBUG'] = 'npm-delegate';

	var badServer;
	var server;
	var allowHead = true;
	before(function(done) {
		badServer = http.createServer(function(req, res) {
			// no response
			if (allowHead && req.method === 'HEAD') {
				res.writeHead(200);
				res.end();
			}
		});
		badServer.listen(8090);

		server = http.createServer(
			delegate(
		  		['http://localhost:8090/'], null, false, {
				timeout: 1000,
				retry: 2
			}));
		server.listen(9090);

		done();
	});

	after(function() {
		badServer.close();
		server.close();
	})

	it('should handle timeout and retry when server is not responsive to HEAD request on check before you leap', function(done) {
		this.timeout(10000);
		allowHead = false;

		request('http://localhost:9090/thing', function(err, res, body) {
			if (err) {
				done(err);
				return;
			}
			body.should.include("error"); 
			done();
		});

	});

	it('should handle timeout when server is not responsive to GET request during streaming', function(done) {
		this.timeout(10000);
		allowHead = true;

		request('http://localhost:9090/thing', function(err, res, body) {
			if (err) {
				done(err);
				return;
			}
			body.should.include('TIMEDOUT');
			done();
		});

	});

});

describe('npm-delegate negative+positive', function() {
	
	process.env['NODE_DEBUG'] = 'npm-delegate';

	var badServer, goodServer;
	var server;
	var allowHead = true;
	before(function(done) {
		badServer = http.createServer(function(req, res) {
			// no response
			if (allowHead && req.method === 'HEAD') {
				res.writeHead(200);
				res.end();
			}
		});
		badServer.listen(8090);

		goodServer = http.createServer(function(req, res) {
			// no response
			res.writeHead(200);
			if (req.method === 'HEAD') {
				res.end();
			}
			res.end('you got it');
		});
		goodServer.listen(8091);

		server = http.createServer(
			delegate(
		  		['http://localhost:8090/', 'http://localhost:8091/'], null, false, {
				timeout: 1000,
				retry: 2
			}));
		server.listen(9090);

		done();
	});

	after(function() {
		badServer.close();
		goodServer.close();
		server.close();
	})

	it('should handle timeout and retry when server is not responsive to HEAD request on check before you leap', function(done) {
		this.timeout(10000);
		allowHead = false;

		request('http://localhost:9090/thing', function(err, res, body) {
			if (err) {
				done(err);
				return;
			}
			res.statusCode.should.be.equal(200);
			body.should.include('you got it');
			done();
		});

	});

	it('should handle timeout when server is not responsive to GET request during streaming', function(done) {
		this.timeout(10000);
		allowHead = true;

		request('http://localhost:9090/thing', function(err, res, body) {
			if (err) {
				done(err);
				return;
			}
			console.log(body);
			done();
		});

	});

});