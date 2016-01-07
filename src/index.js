var express = require('express'),
    router = express.Router(),
    redis = require('redis'),
    _ = require('lodash'),
    Creator = require('./creator'),
    mongoose = require('mongoose'),
    client;

module.exports = {
  router: function(options){
    var key,
        model,
        scheme = options.scheme,
        cors = options.cors,
        applyChildren = function(key, scheme, model){
          _.each(model, function(attr, childKey){
            if(attr.children) {
              creator.getChildren( key, attr, childKey, scheme[attr.children] );
            }
          });
        };

    mongoose.connect(options.mongo);
    creator = new Creator(mongoose, router, cors);

    for( key in scheme ){
      model = scheme[key];
      creator.model(key, model);
      creator.getInstance( key, model );
      creator.getCollection( key, model );
      applyChildren(key, scheme, model);

      creator.postInstance( key, model );
      creator.postAsUpdate(key, model);

      creator.deleteCollection(key, model);
      creator.deleteInstance(key, model);
      creator.validate(key, model);
    }
    if(cors) {
      router.options('*', require('cors')());
    }
    this.creator = creator;
    return router;
  },
  doc: function(doc){
    creator.createDoc(doc);
  }
};
