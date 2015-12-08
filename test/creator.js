var assert = require('assert'),
    should = require('should'),
    express = require('express'),
    router = express.Router(),
    redis = require('redis'),
    _ = require('lodash'),
    Client = require('../src/client'),
    Creator = require('../src/creator'),
    client;


describe('Creator', function () {
  
  it('should create Creator instance', function (done) {
    client = new Client(process.env.REDIS_URL);
    creator = new Creator(router, client);
    done();
  });
});