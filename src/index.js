var express = require('express'),
    router = express.Router(),
    redis = require('redis'),
    _ = require('lodash'),
    Client = require('./client'),
    Creator = require('./creator'),
    client;

module.exports = function(options){
  var key,
      model,
      scheme = options.scheme,
      applyChildCollection = function(key, scheme, model){
        _.each(model, function(attr, childKey){
          if(attr.children) {
            creator.getChildrenCollection( key, attr, childKey, scheme[attr.children] );
          }
        });
      };

  client = new Client(options.redis);
  creator = new Creator(router, client);

  for( key in scheme ){
    model = scheme[key];
    creator.getCollection( key, model );
    creator.postInstance( key, model );
    creator.getInstance( key, model );

    applyChildCollection(key, scheme, model);
    creator.postUpdateInstance(key, model);
    creator.deleteCollection(key, model);
    creator.deleteInstance(key, model);
  }
  return router;
};