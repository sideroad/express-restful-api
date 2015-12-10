var _ = require('lodash'),
    util = require('util'),
    moment = require('moment'),
    async = require('async'),
    path = require('path'),
    fs   = require('fs'),
    crypto = require('crypto'),
    validate = require('./validate'),
    resutils = require('./resutils');

var Creator = function(router, client){
  this.router = router;
  this.client = client;
};

Creator.prototype = {
  params: function(model, req, isRaw){
    var params = {};
    _.map(model, function(option, key){
      var value = req.body[key] || '';

      if(option.children) {
        params[key] = value ? value.split(',') : 
                      isRaw ? undefined : [];
      } else {
        params[key] = value ? value :
                      isRaw ? undefined : '';      
      }
    });
    return params;
  },

  href: function(model, collectionKey, collection){
    _.each(model, function(option, key){
      var childrenCollectionKey,
          parentCollectionKey,
          instanceKey;
      if( option.children ){
        collection = _.map(collection, function(instance){
          instance[key] = {
            href: '/'+collectionKey+'/'+instance.id+'/'+key
          };
          return instance;
        });
      }

      if( option.parent ){
        parentCollectionKey = option.parent + 's';
        collection = _.map(collection, function(instance){
          instance[key] = {
            href: '/'+parentCollectionKey+'/'+instance[key]
          };
          return instance;
        });
      }

      if( option.instance ){
        instanceKey = option.instance;
        collection = _.map(collection, function(instance){
          instance[key] = {
            href: instance[key] ? '/'+instanceKey+'s'+'/'+instance[key] : null
          };
          return instance;
        });
      }
    });
    return collection;
  },

  getCollection: function(key, model){
    var that = this;
    var collectionKey = key + 's';
    /**
     * Return collection
     * @return {List of group object } 
     */
    this.router.get('/'+collectionKey, function(req, res){
      
      async.waterfall([
        function(callback){
          that.client.getCollection(collectionKey, function(err, collection){
            callback(err, collection);
          });
        }
      ], function done(err, collection){
        resutils.accessControl(res, req);

        if(err) {
          resutils.error(res, err);
          return;
        }

        that.href(model, collectionKey, collection);

        var offset = Number(req.params.offset || 0),
            limit = Number(req.params.limit || 25),
            size = collection.length,
            json = {
              offset: offset,
              limit: limit,
              size: size,
              first: collection.length ? '/'+collectionKey+'?offset=0&limit='+limit : null,
              last: collection.length ? '/'+collectionKey+'?offset='+ (Math.round( size / limit ) * limit) + '&limit='+limit : null,
              items: collection
            };

        res.json(json);
        res.end();
      });
    });
  },

  postInstance: function(key, model){
    var that = this;
    var collectionKey = key + 's';
    /**
     * Create new instance data and return instance URI with 201 status code
     */
    this.router.post('/'+collectionKey, function(req, res){
      var id,
          key,
          uniqKeys = _.chain(model)
                      .map(function(value, key){
                        return value.uniq ? key : undefined;
                      })
                      .compact()
                      .value(),
          md5 = crypto.createHash('md5'),
          params = that.params(model, req),
          process = [],
          results = validate(model, params);

      if( !results.ok ) {
        res.json(results, 400 );
        return;
      }

      id = uniqKeys.map(function(key){
        return params[key].replace(/[\s\.\/]+/g, '_').toLowerCase();
      }).join('-');

      _.each(model, function(paramConfig, paramKey){
        var parentCollectionKey;

        if(paramConfig.parent) {
          parentInstanceKey = paramConfig.parent;
          parentCollectionKey = paramConfig.parent + 's';

          process = process.concat([
            function(callback){
              that.client.getCollection(parentCollectionKey, function(err, parentCollection){
                callback(err, parentCollection);
              });
            },
            function(parentCollection, callback){
              parentCollection = _.map(parentCollection, function(parent){
                if (parent.id === req.body[parentInstanceKey]) {
                  var now = moment().format();

                  parent[collectionKey].push(id);
                  parent.updatedAt = now;
                }
                return parent;
              });
              callback(null, parentCollection);
            },  
            function(parentCollection, callback){
             that.client.setCollection(parentCollectionKey, parentCollection, function(err){
                callback(err);
              });
            }
          ]);

        }
      });

      process = process.concat([
        function(callback){
          that.client.getCollection(collectionKey, function(err, collection){
            callback(err, collection);
          });
        },
        function(collection, callback){
          var now = moment().format();
          that.client.setCollection(collectionKey, collection.concat([

            _.assign({
                id: id
            }, params, {
              createdAt: now,
              updatedAt: now
            })
          ]), function(err){
            callback(err);
          });
        }
      ]);

      async.waterfall(process, function done(err){
        resutils.accessControl(res, req);

        if(err) {
          resutils.error(res, err);
          return;
        }
        res.location('/'+collectionKey+'/' + id );
        res.status(201).send(null);
      });
    });
  },

  getInstance: function(key, model){
    var that = this;
    var collectionKey = key + 's';

    /**
     * Get specified instance by ID
     */
    this.router.get('/'+collectionKey + '/:id', function(req, res){
      var id = req.params.id;

      async.waterfall([
        function(callback){
          that.client.getCollection(collectionKey, function(err, collection){
            callback(err, collection);
          });
        },  
        function(collection, callback){
          var instance = _.find(collection, { 'id': id }),
              err;
          if( !instance ) {
            err = new Error(key+' does not exists');
            err.code = 404;
          }
          callback(err, instance);
        }
      ], function done(err, instance){
        resutils.accessControl(res, req);
        if(err) {
          resutils.error(res, err);
          return;
        }

        instance = that.href(model, collectionKey, [instance])[0];

        res.send(instance);
      });
    });
  },

  getChildrenCollection: function(key, attr, childKey, childModel){
    var that = this;
    var collectionKey = key + 's',
        childrenCollectionKey = attr.children + 's';

    /**
     * Return children collection
     * @return children as collection
     */
    this.router.get('/'+collectionKey+'/:id/'+childKey, function(req, res){
      var id = req.params.id;

      async.waterfall([
        function(callback){
          that.client.getCollection(childrenCollectionKey, function(err, childrenCollection){
            callback(err, childrenCollection);
          });
        },
        function(childrenCollection, callback){
          var cond = {};
          cond[key] = id;
          childrenCollection = _.filter(childrenCollection, cond);
          callback(null, childrenCollection);
        },  
      ], function done(err, childrenCollection){
        resutils.accessControl(res, req);

        if(err) {
          resutils.error(res, err);
          return;
        }

        that.href(childModel, childrenCollectionKey, childrenCollection);

        var offset = Number(req.params.offset || 0),
            limit = Number(req.params.limit || 25),
            size = childrenCollection.length,
            json = {
              offset: offset,
              limit: limit,
              size: size,
              first: childrenCollection.length ? '/'+collectionKey+'/'+id+'/'+childKey+'?offset=0&limit='+limit : null,
              last: childrenCollection.length  ? '/'+collectionKey+'/'+id+'/'+childKey+'?offset='+ (Math.round( size / limit ) * limit) + '&limit='+limit : null,
              items: childrenCollection
            };

        res.json(json);
        res.end();
      });

    });

  },


  putInstance: function(key, model){
    var that = this;
    var collectionKey = key + 's';

    /**
     * Update instance as full replacement with specified ID
     */
    this.router.put('/' + collectionKey + '/:id', function(req, res){
      var params = that.params( model, req );

      async.waterfall([
        function(callback){
          that.client.getCollection(collectionKey, function(err, collection){
            callback(err, collection);
          });
        },  
        function(collection, callback){
          collection = _.map(collection, function(instance){
            if (instance.id === req.params.id) {
              var now = moment().format();
              instance = _.assign(params, instance, {
                updatedAt: now
              });
            }
            return instance;
          });

          callback(err, collection);
        },  
        function(collection, callback){
         that.client.setCollection(collectionKey, collection, function(err){
            callback(err);
          });
        }
      ], function done(err, instance){
        resutils.accessControl(res, req);
        if(err) {
          resutils.error(res, err);
          return;
        }

        res.status(200).send(null);
      });
    });
  },

  postUpdateInstance: function(key, model){
    var that = this;
    var collectionKey = key + 's';

    /**
     * Update instance as partial replacement with specified ID
     */
    this.router.post('/' + collectionKey + '/:id', function(req, res){
      var params = that.params( model, req, true );

      async.waterfall([
        function(callback){
          that.client.getCollection(collectionKey, function(err, collection){
            callback(err, collection);
          });
        },  
        function(collection, callback){
          collection = _.map(collection, function(instance){
            if (instance.id === req.params.id) {
              instance = _.assign( instance, params, function(value, other) {
                return _.isUndefined(other) ? value : other;
              });
              var now = moment().format();
              instance.updatedAt = now;
            }
            return instance;
          });

          callback(null, collection);
        },  
        function(collection, callback){
         that.client.setCollection(collectionKey, collection, function(err){
            callback(err);
          });
        }
      ], function done(err, instance){
        resutils.accessControl(res, req);

        if(err) {
          resutils.error(res, err);
          return;
        }

        res.status(200).send(null);
      });
    });
  },

  deleteCollection: function(key, model){
    var that = this;
    var collectionKey = key + 's';

    /**
     * Delete all collection
     * @return
     */
    this.router.delete('/'+collectionKey, function(req, res){
      async.waterfall([
        function(callback){
          that.client.setCollection(collectionKey, [], function(err){
            callback(err);
          });
        }
      ], function done(err){
        resutils.accessControl(res, req);

        if(err) {
          resutils.error(res, err);
          return;
        }
        res.status(200).send(null);
      });
    });

  },

  deleteInstance: function(key, model){
    var that = this;
    var collectionKey = key + 's';

    /**
     * Delete specified instance
     * @return
     */
    this.router.delete('/'+collectionKey+'/:id', function(req, res){
      async.waterfall([
        function(callback){
          that.client.getCollection(collectionKey, function(err, collection){
            callback(err, collection);
          });
        },  
        function(collection, callback){
          collection = _.chain(collection)
                        .map(function(instance){
                          if (instance.id === req.params.id) {
                            return undefined;
                          }
                          return instance;
                        })
                        .compact()
                        .value();

          callback(null, collection);
        },  
        function(collection, callback){
         that.client.setCollection(collectionKey, collection, function(err){
            callback(err);
          });
        }
      ], function done(err, instance){
        resutils.accessControl(res, req);

        if(err) {
          resutils.error(res, err);
          return;
        }

        res.status(200).send(null);
      });

    });
  }

};

module.exports = Creator;
