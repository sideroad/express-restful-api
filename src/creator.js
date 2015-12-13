var _ = require('lodash'),
    util = require('util'),
    moment = require('moment'),
    async = require('async'),
    path = require('path'),
    fs   = require('fs'),
    crypto = require('crypto'),
    validate = require('./validate'),
    resutils = require('./resutils');

var Creator = function(mongoose, router){
  this.mongoose = mongoose;
  this.router = router;
  this.models = {};
  this.schemes = {};
};

Creator.prototype = {

  model: function(key, model){
    var scheme = {
      id: String,
      createdAt: String,
      updatedAt: String
    };

    _.each(model, function(attr, name){
      scheme[name] = attr.type === 'number' ? Number :
                     attr.children          ? Array  : String;
    });

    this.models[key] = this.mongoose.model(key, scheme);
    this.schemes[key] = scheme;
  },

  fields: function(key) {
    return _.map(this.schemes[key], function(attr, name) {
      return name;
    }).join(' ');
  },

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

  toObject: function(collection){
    return _.map(collection, function(instance){
      return instance.toObject ? instance.toObject() : instance;
    });
  },

  href: function(model, collectionKey, collection){

    var collection = this.toObject(collection);
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
        parentCollectionKey = option.parent.split('.')[0] + 's';
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
    var that = this,
        keys = key + 's',
        fields = this.fields(key);

    /**
     * Return collection
     * @return {List of group object } 
     */
    this.router.get('/'+keys, function(req, res){
      var offset = Number(req.params.offset || 0),
          limit = Number(req.params.limit || 25);
      
      async.waterfall([
        function(callback){
          that.models[key].find(null, null, {
            skip: offset,
            limit: limit
          }, function(err, collection){
            callback(err, collection);
          });
        }
      ], function done(err, collection){
        resutils.accessControl(res, req);

        if(err) {
          resutils.error(res, err);
          return;
        }

        collection = that.href(model, keys, collection);

        var size = collection.length,
            json = {
              offset: offset,
              limit: limit,
              size: size,
              first: collection.length ? '/'+keys+'?offset=0&limit='+limit : null,
              last: collection.length ? '/'+keys+'?offset='+ (Math.round( size / limit ) * limit) + '&limit='+limit : null,
              items: collection
            };

        res.json(json);
        res.end();
      });
    });
  },

  postInstance: function(key, model){
    var that = this,
        keys = key + 's';
    /**
     * Create new instance data and return instance URI with 201 status code
     */
    this.router.post('/'+keys, function(req, res){
      var id,
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

      if(!id){
        md5.update(new Date().getTime() + ':' + Math.random());
        id = md5.digest('hex').substr(0,7);
      }

      // Push key onto parent object
      _.each(model, function(attr){
        if(attr.parent) {
          var key = attr.parent.split('.')[0],
              child = attr.parent.split('.')[1];

          process = process.concat([
            function(callback){
              that.models[key].findOne({
                id: req.body[key]
              }, function(err, parent){
                  callback(err, parent);
              });
            },
            function(parent, callback){

              if(parent) {
                var now = moment().format();
                parent[child].push(id);
                parent.updatedAt = now;
                parent.save(function(err){
                  callback(err);
                });
              } else {
                callback(null);
              }
            }
          ]);
        }
      });

      process = process.concat([
        function(callback){
          var now = moment().format(),
              Model = that.models[key],
              instance = new Model(
                _.assign({
                    id: id
                }, params, {
                  createdAt: now,
                  updatedAt: now
                })
              );

          instance.save(function(err){
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
        res.location('/'+keys+'/' + id );
        res.status(201).send(null);
      });
    });
  },

  getInstance: function(key, model){
    var that = this,
        keys = key + 's',
        fields = this.fields(key);

    /**
     * Get specified instance by ID
     */
    this.router.get('/'+keys + '/:id', function(req, res){
      var id = req.params.id;

      async.waterfall([
        function(callback){
          that.models[key].findOne({
            id: id
          }, fields, function( err, instance ){
            if( !instance ) {
              err = new Error(key+' does not exists');
              err.code = 404;
            }

            callback(err, instance ? instance : {});
          });
        }
      ], function done(err, instance){
        resutils.accessControl(res, req);
        if(err) {
          resutils.error(res, err);
          return;
        }

        instance = that.href(model, keys, [instance])[0];

        res.send(instance);
      });
    });
  },

  getChildren: function(parentKey, attr, key, model){
    var that = this,
        parentKeys = parentKey + 's',
        keys = attr.children + 's',
        fields = this.fields(key);

    /**
     * /groups/uxd/members
     *
     * key: group
     * attr: { children: people }
     * key: members
     * model: {  }
     * 
     * Return children collection
     * @return children as collection
     */
    this.router.get('/'+parentKeys+'/:id/'+key, function(req, res){
      var id = req.params.id;

      async.waterfall([
        function(callback){
          var cond = {};
          cond[parentKey] = id;

          that.models[attr.children].find(cond, fields, function(err, collection){
            callback(err, collection);
          });
        }
      ], function done(err, collection){
        resutils.accessControl(res, req);

        if(err) {
          resutils.error(res, err);
          return;
        }

        collection = that.href(model, keys, collection);

        var offset = Number(req.params.offset || 0),
            limit = Number(req.params.limit || 25),
            size = collection.length,
            json = {
              offset: offset,
              limit: limit,
              size: size,
              first: collection.length ? '/'+parentKeys+'/'+id+'/'+key+'?offset=0&limit='+limit : null,
              last: collection.length  ? '/'+parentKeys+'/'+id+'/'+key+'?offset='+ (Math.round( size / limit ) * limit) + '&limit='+limit : null,
              items: collection
            };

        res.json(json);
        res.end();
      });

    });

  },


  putAsUpdate: function(key, model){
    var that = this,
        keys = key + 's';

    /**
     * Update instance as full replacement with specified ID
     */
    this.router.put('/' + keys + '/:id', function(req, res){
      var params = that.params( model, req );

      async.waterfall([
        function(callback){
          var now = moment().format();

          that.models[key].findOneAndUpdate({
            id: req.params.id
          }, _.assign(params, {
                updatedAt: now
          }), function(err, instance){
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

  postAsUpdate: function(key, model){
    var that = this,
        keys = key + 's';

    /**
     * Update instance as partial replacement with specified ID
     */
    this.router.post('/' + keys + '/:id', function(req, res){
      var params = that.params( model, req, true );

      async.waterfall([
        function(callback){
          var now = moment().format();

          that.models[key].findOneAndUpdate({
            id: req.params.id
          }, _.assign(params, {
                updatedAt: now
          }), function(err, instance){
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
    var that = this,
        keys = key + 's';

    /**
     * Delete all collection
     * @return
     */
    this.router.delete('/'+keys, function(req, res){
      async.waterfall([
        function(callback){
          that.models[key].find(function(err, collection){

            async.map(collection, function(instance, callback){
              instance.remove(function(err){
                callback(err);
              });
            }, function(err){
              callback(err);
            });
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
    var that = this,
        keys = key + 's';

    /**
     * Delete specified instance
     * @return
     */
    this.router.delete('/'+keys+'/:id', function(req, res){
      async.waterfall([
        function(callback){
          that.models[key].findOneAndRemove({
            id: req.params.id
          }, function(err){
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
