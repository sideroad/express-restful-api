var express = require('express'),
    redis = require('redis'),
    _ = require('lodash'),
    Creator = require('./creator'),
    mongoose = require('mongoose'),
    creator,
    client;

module.exports = {
  router: function(options){
    var key,
        model,
        router = express.Router(),
        schema = options.schema,
        prefix = options.prefix,
        before = options.before,
        after = options.after,
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
    creator = new Creator(mongoose, router, prefix, before, after);

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
    }
    this.creator = creator;
    return router;
  },
  doc: function(doc){
    creator.createDoc(doc);
  },
  destroy: function(){
    creator.unroute();
  }
};
