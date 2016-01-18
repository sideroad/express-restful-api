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
        schema = options.schema,
        cors = options.cors,
        prefix = options.prefix,
        applyChildren = function(key, schema, model){
          _.each(model, function(attr, childKey){
            if(attr.type === 'children') {
              creator.getChildren( key, attr, childKey, schema[attr.relation] );
            }
          });
        };

    if ( typeof options.mongo === 'string' ) {
      mongoose.connect(options.mongo);
    } else {
      mongoose = options.mongo;
    }
    creator = new Creator(mongoose, router, cors, prefix);

    for( key in schema ){
      model = schema[key];
      creator.model(key, model);
      creator.getInstance( key, model );
      creator.getCollection( key, model );
      applyChildren(key, schema, model);

      creator.postInstance( key, model );
      creator.postAsUpdate(key, model);

      creator.deleteCollection(key, model);
      creator.deleteInstance(key, model);
      creator.validate(key, model);
    }
    this.creator = creator;
    return router;
  },
  doc: function(doc){
    creator.createDoc(doc);
  }
};
