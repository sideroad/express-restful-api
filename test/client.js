var assert = require('assert'),
    should = require('should'),
    async  = require('async'),
    Client = require('../src/client');



describe('Client', function() {
  var client;

  before(function() {
    client = new Client(process.env.REDIS_URL);
    return client;
  });

  describe('#constructor', function () {
    it('should return client instance', function () {
      should.exist(client);
    });
  });

  describe('#instance', function () {
    it('should get / set instance', function(done){
      var data = {
            a: 1
          },
          empty = {},
          KEY = 'test-express-restful-api-instance';

      async.waterfall([
        function(callback){
          client.setInstance(KEY, data, function(err){
            callback(err);
          });
        },
        function(callback){
          client.getInstance(KEY, function(err, result){
            result.should.deepEqual(data);
            callback(err);
          });
        },
        function(callback){
          client.setInstance(KEY, empty, function(err){
            callback(err);
          });
        },
        function(callback){
          client.getInstance(KEY, function(err, result){
            result.should.deepEqual(empty);
            callback(err);
          });
        }
      ], function(err, result){
        should(err).not.be.ok();
        done();
      });
    });
  });

  describe('#collection', function () {
    it('should get / set collection', function(done){
      var data = [{
            a: 1
          }, {
            b: 2
          }],
          empty = [],
          KEY = 'test-express-restful-api-collection';

      async.waterfall([
        function(callback){
          client.setCollection(KEY, data, function(err){
            callback(err);
          });
        },
        function(callback){
          client.getCollection(KEY, function(err, result){
            result.should.deepEqual(data);
            callback(err);
          });
        },
        function(callback){
          client.setCollection(KEY, empty, function(err){
            callback(err);
          });
        },
        function(callback){
          client.getCollection(KEY, function(err, result){
            result.should.deepEqual(empty);
            callback(err);
          });
        }
      ], function(err, result){
        should(err).not.be.ok();
        done();
      });
    });

  });
});

