var url = require('url'),
    redis = require('redis'),
    redisClient,
    Client = function(connection){
      var redisURL = url.parse(connection);
      
      redisClient = redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
      redisClient.auth(redisURL.auth.split(":")[1]);
    };

Client.prototype = {
  getCollection: function(key, callback){
    redisClient.get(key, function(err, data){
      callback( err, JSON.parse(data || '[]'));
    });
  },
  setCollection: function(key, value, callback){
    redisClient.set(key, JSON.stringify(value || []), function(err){
      callback( err );
    });
  },
  getInstance: function(key, callback){
    redisClient.get(key, function(err, data){
      callback( err, JSON.parse(data || '{}'));
    });
  },
  setInstance: function(key, value, callback){
    redisClient.set(key, JSON.stringify(value || {}), function(err){
      callback( err );
    });
  }
};

module.exports = Client;
