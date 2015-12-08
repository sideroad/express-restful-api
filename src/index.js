var express = require('express'),
    router = express.Router(),
    redis = require('redis'),
    _ = require('lodash'),
    Client = require('./client'),
    Creator = require('./creator'),
    client;

module.exports = function(options){
  var key,
      attr,
      scheme = options.scheme,
      applyChildCollection = function(key, scheme, attr){
        _.each(attr, function(paramConfig, childrenCollectionKey){
          if(paramConfig.children) {
            creator.getChildrenCollection( key, scheme[paramConfig.children], childrenCollectionKey, paramConfig );
          }
        });
      };

  client = new Client(options.redis);
  creator = new Creator(router, client);

  for( key in scheme ){
    attr = scheme[key];
    creator.getCollection( key, attr );
    creator.postInstance( key, attr );
    creator.getInstance( key, attr );

    applyChildCollection(key, scheme, attr);
    creator.postUpdateCollection(key, attr);
    creator.deleteCollection(key, attr);
    creator.deleteInstance(key, attr);
  }
  return router;
};