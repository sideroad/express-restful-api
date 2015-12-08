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
  params: function(config, req, isRaw){
    var params = {};
    _.map(config, function(option, key){
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

  href: function(config, collectionKey, collection){
    _.each(config, function(option, key){
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

  getCollection: function(key, config){
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

        that.href(config, collectionKey, collection);

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

  postInstance: function(key, config){
    var that = this;
    var collectionKey = key + 's';
    /**
     * Create new instance data and return instance URI with 201 status code
     */
    this.router.post('/'+collectionKey, function(req, res){
      var id,
          key,
          uniqKeys = _.chain(config)
                      .map(function(value, key){
                        return value.uniq ? key : undefined;
                      })
                      .compact()
                      .value(),
          md5 = crypto.createHash('md5'),
          params = that.params(config, req),
          process = [],
          results = validate(config, params);

      if( !results.ok ) {
        res.json(results, 400 );
        return;
      }

      md5.update(uniqKeys.map(function(key){
        return params[key];
      }).join(':'));
      id = md5.digest('hex').substr(0,7);


      _.each(config, function(paramConfig, paramKey){
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
        res.send(201, null);
      });
    });
  },

  getInstance: function(key, config){
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

        instance = that.href(config, collectionKey, [instance])[0];

        res.send(instance);
      });
    });
  },

  getChildrenCollection: function(key, config, childPath, paramConfig){
    var that = this;
    var collectionKey = key + 's',
        childrenCollectionKey = paramConfig.children + 's';

    /**
     * Return children collection
     * @return children as collection
     */
    this.router.get('/'+collectionKey+'/:id/'+childPath, function(req, res){
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

        that.href(config, childrenCollectionKey, childrenCollection);

        var offset = Number(req.params.offset || 0),
            limit = Number(req.params.limit || 25),
            size = childrenCollection.length,
            json = {
              offset: offset,
              limit: limit,
              size: size,
              first: childrenCollection.length ? '/'+collectionKey+'/'+id+'/'+childPath+'?offset=0&limit='+limit : null,
              last: childrenCollection.length  ? '/'+collectionKey+'/'+id+'/'+childPath+'?offset='+ (Math.round( size / limit ) * limit) + '&limit='+limit : null,
              items: childrenCollection
            };

        res.json(json);
        res.end();
      });

    });

  },


  putInstance: function(key, config){
    var that = this;
    var collectionKey = key + 's';

    /**
     * Update instance as full replacement with specified ID
     */
    this.router.put('/' + collectionKey + '/:id', function(req, res){
      var params = that.params( config, req );

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

        res.send(200, null);
      });
    });
  },

  postUpdateCollection: function(key, config){
    var that = this;
    var collectionKey = key + 's';

    /**
     * Update instance as partial replacement with specified ID
     */
    this.router.post('/' + collectionKey + '/:id', function(req, res){
      var params = that.params( config, req, true );

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

        res.send(200, null);
      });
    });
  },

  deleteCollection: function(key, config){
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
        res.send(200, null);
      });
    });

  },

  deleteInstance: function(key, config){
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
                      if (instance.id === req.body.id) {
                        return undefined;
                      }
                      return instance;
                    })
                    .compact()
                    .value();

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

        res.send(200, null);
      });

    });
  }

};

module.exports = Creator;
