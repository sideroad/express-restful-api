var _ = require('lodash'),
    util = require('util'),
    moment = require('moment'),
    async = require('async'),
    path = require('path'),
    fs   = require('fs-extra'),
    crypto = require('crypto'),
    validate = require('./validate'),
    resutils = require('./resutils'),
    apidoc = require('apidoc'),
    pluralize = require('pluralize'),
    camelize = require('camelize'),
    cors = require('cors'),
    unroute = require('unroute');

var Creator = function(mongoose, router, cors, prefix){
  this.mongoose = mongoose;
  this.router = router;
  this.prefix = prefix || '';
  this.cors = cors;
  this.models = {};
  this.schemas = {};
  this.requestAttrs = {};
  this.responseAttrs = {};
  this.docs = [];
  this.docOrder = [];
  if(cors) {
    router.options('*', require('cors')(
      cors === true ? {
        origin: function(origin, callback){
          callback(null, [origin]);
        },
        credentials: true
      } : cors
    ));
  }
};

Creator.prototype = {

  createDoc: function(_doc){
    var doc = _.assign({
          order: this.docOrder
        }, _doc),
        source = path.join( doc.dest, 'apicomment.js' );

    if(fs.existsSync(source)){
      fs.unlinkSync(source);
    }

    fs.mkdirsSync(doc.dest);
    fs.writeFileSync(path.join( doc.dest, 'apidoc.json'), JSON.stringify(doc));
    fs.writeFileSync(source, this.docs.join('\n'));

    apidoc.createDoc({
      src: doc.dest,
      dest: doc.dest,
      config: doc.dest
    });

    // apply patch for doc sample ajax
    fs.copySync( path.join( __dirname, '../patch/send_sample_request.js' ), path.join(doc.dest, 'utils/send_sample_request.js'));
  },

  doc: function(doc){
    var group = doc.group.substr(0,1).toUpperCase() + doc.group.substr(1),
        responseAttrs = this.responseAttrs,
        requestAttrs  = this.requestAttrs,
        schemas = this.schemas,
        prefix = this.prefix,
        apiName = camelize( group + doc.name.replace(/\s+/g, '_') ),
        getApiParam = function(){
            var params = [];

            if( doc.method === 'post' ||
                doc.collection ||
                doc.validate ){
                params = params.concat(
                  _.map(requestAttrs[doc.group], function(attr, key){
                    return attr.type === 'children' ? '' :
                           '@apiParam {'+
                              (attr.type === 'number'  ? 'Number'  :
                               attr.type === 'boolean' ? 'Boolean' : 'String')+
                            '} ' +
                            (doc.create && ( attr.required || attr.uniq ) ? key : '[' + key + ']') +
                            (doc.create && attr.default                   ? '=' + attr.default : '' ) + ' ' +
                            (attr.desc     ? attr.desc :
                             attr.type === 'instance' ? attr.relation + ' id' : '');
                  })
                );
            }

            if( doc.method === 'get' ) {
              params.push('@apiParam {String} [fields] Pertial attribution will be responsed.');
              params.push('                   Attributions should be separated with comma.');
            }
            return params.join('\n * ')
        },
        apiSuccess = doc.method !== 'get' ? '' :
                     doc.collection ? [
                       '@apiSuccess {Number} offset',
                       '@apiSuccess {Number} limit',
                       '@apiSuccess {Number} size',
                       '@apiSuccess {String} first',
                       '@apiSuccess {String} last',
                       '@apiSuccess {String} prev',
                       '@apiSuccess {String} next',
                       '@apiSuccess {Object[]} items Array of '+group+' instance',
                     ].join('\n * ') :
                     _.map(schemas[doc.group], function(schema, key){
                       var attr = responseAttrs[doc.group][key] || {};
                       return '@apiSuccess {'+
                                 (attr.type === 'number'   ? 'Number'  :
                                  attr.type === 'boolean'  ? 'Boolean' :
                                  attr.type === 'children' ? 'Object'  :
                                  attr.type === 'instance' ? 'Object'  : 'String')+
                               '} ' + key + ' ' +
                                 (attr.desc                ? attr.desc :
                                  attr.type === 'children' ? 'linking of ' + ( attr.relation ) :
                                  attr.type === 'instance' ? 'linking of ' + ( attr.relation ) : '');
                     }).join('\n * ');

    this.docs.push(
      '/**\n'+
      ' * @api {'+doc.method+'} '+doc.url+' '+doc.name+'\n'+
      ' * @apiName ' + apiName + '\n' +
      ' * @apiGroup ' + group  + '\n' +
      ' * ' + getApiParam()    + '\n' +
      ' * ' + apiSuccess       + '\n' +
      ' */\n'
    );
    this.docOrder.push(apiName);
  },

  model: function(key, _attr){
    var schemaType = {},
        model,
        attr = _.assign({
          id: {}
        }, _attr, {
          createdAt: {
            type: 'date'
          },
          updatedAt: {
            type: 'date'
          }
        });

    _.each(attr, function(attr, name){
      var type = attr.type === 'number'   ? Number  :
                 attr.type === 'boolean'  ? Boolean :
                 attr.type === 'date'     ? Date    :
                 attr.type === 'children' ? Array   : String;

      schemaType[name] = {
        type: type,
        default: attr.default || null
      };
    });

    schema = new this.mongoose.Schema(_.assign({
      q: String
    }, schemaType), { minimize: false });
    schema.index({ id: 1 });

    model = this.mongoose.model(this.prefix + key, schema);
    this.models[key]  = model;
    this.schemas[key] = schemaType;
    this.responseAttrs[key]   = attr;
    this.requestAttrs[key] = _attr;
  },

  fields: function(key, params) {
    return _.map( params || this.schemas[key], function(attr, name) {
      return name;
    }).join(' ') + ' -_id';
  },

  params: function(model, req){
    var params = {};
    _.map(model, function(option, key){
      var value = req.body[key]   !== undefined ? req.body[key]   :
                  req.params[key] !== undefined ? req.params[key] :
                  req.query[key]  !== undefined &&
                  req.query[key]  !== null &&
                  req.query[key]  !== ''        ? req.query[key]  : undefined;

      if(option.type === 'children') {
        value = value !== undefined ? value : [];
      }

      if(_.isArray(value) ? value.length :
         value !== undefined ) {
        params[key] = value;
      }

    });
    return params;
  },

  cond: function(model, req ){
    var params = this.params( model, req ),
        cond = {};

    _.each(params, function(val, key){
      var type = model[key].type,
          search = type === 'number' ||
                   type === 'date'   ?  'range' : 'wildcard';

      val = val && val.length ? val : '';
      cond[key] = search === 'wildcard'                          ? new RegExp('^'+val.replace(/\*/g, '.*') + '$') :
                  search === 'range' && /^\[.+\,.+\]$/.test(val) ? {
                                                                     $gte: val.match(/^\[(.+)\,(.+)\]$/)[1],
                                                                     $lte: val.match(/^\[(.+)\,(.+)\]$/)[2]
                                                                   } : val;
    });

    if(req.query.q) {
      cond.q = new RegExp( req.query.q );
    }

    return cond;
  },

  toObject: function(collection){
    return _.map(collection, function(instance){
      return instance.toObject ? instance.toObject() : instance;
    });
  },

  href: function(model, collectionKey, collection){
    var prefix = this.prefix;
    collection = this.toObject(collection);
    _.each(model, function(option, key){
      var childrenCollectionKey,
          parentCollectionKey,
          instanceKey;

      if( option.type === 'children' ){
        collection = _.map(collection, function(instance){
          if( instance.hasOwnProperty(key) ) {
            instance[key] = {
              href: prefix + '/'+collectionKey+'/'+instance.id+'/'+key
            };
          }
          return instance;
        });
      }

      if( option.type === 'parent' ){
        parentCollectionKey = pluralize(option.relation.split('.')[0]);
        collection = _.map(collection, function(instance){
          if( instance.hasOwnProperty(key) ) {
            instance[key] = {
              href: prefix + '/'+parentCollectionKey+'/'+instance[key],
              id: instance[key]
            };
          }
          return instance;
        });
      }

      if( option.type === 'instance' ){

        instanceKey = option.relation;
        collection = _.map(collection, function(instance){
          if( instance.hasOwnProperty(key) ) {
            instance[key] = {
              href: instance[key] ? prefix + '/'+pluralize(instanceKey)+'/'+instance[key] : null,
              id: instance[key]
            };
          }
          return instance;
        });
      }
    });
    return collection;
  },

  validateRelatedDataExistance: function(req, schema){
    var process = [],
        that = this;

    _.each(schema, function(attr, name){
      var id,
          key;

      if(attr.type === 'parent') {
        key = attr.relation.split('.')[0];
      }
      if(attr.type === 'instance') {
        key = attr.relation;
      }
      id = req.body[name];
      if( key && id ) {
        process.push(
          function(callback){
            that.models[key].findOne({
              id: id
            }, function(err, instance){
              if( !instance ) {
                err = {
                  err: {}
                };
                err.err[name] = 'Specified ID ( ' + id + ' ) does not exists in ' + key;
                err.code = 400;
              }
              callback(err);
            });
          }
        );
      }
    });
    return process;
  },

  getProcessUpdateParent: function(req, schema, model){
    var process = [];
    _.each(schema, function(attr){
      if(attr.type === 'parent') {
        var key = attr.relation.split('.')[0],
            child = attr.relation.split('.')[1];

        process = process.concat([
          function(callback){
            model.findOne({
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
    return process;
  },

  getCollection: function(key, model){
    var that = this,
        keys = pluralize(key),
        fields = this.fields(key),
        prefix = this.prefix;

    /**
     * Return collection
     * @return {List of group object }
     */
    this.doc({
      method: 'get',
      url : prefix + '/'+keys,
      group: key,
      name: 'Get collection',
      collection: true
    });
    this.router.get(prefix + '/'+keys, function(req, res){
      var offset = Number(req.query.offset || 0),
          limit = Number(req.query.limit || 25),
          cond = that.cond(model, req),
          prev = offset - limit,
          next = offset + limit;

      async.waterfall([
        function(callback){
          var reqFields = req.query.fields;

          that.models[key].find(cond, reqFields ? reqFields.replace(/,/g, ' ') + ' -_id' : fields, {
            skip: offset,
            limit: limit
          }, function(err, collection){
            callback(err, collection);
          });
        },
        function(collection, callback){
          that.models[key].count(cond, function(err, size){
            callback(err, collection, size);
          });
        }
      ], function done(err, collection, size){
        resutils.accessControl(res, req, that.cors);

        if(err) {
          resutils.error(res, err);
          return;
        }

        collection = that.href(model, keys, collection);

        var json = {
              offset: offset,
              limit: limit,
              size: size,
              first: size                 ? prefix + '/'+keys+'?offset=0&limit=' + limit : null,
              last:  size                 ? prefix + '/'+keys+'?offset=' + ( ( Math.ceil( size / limit ) - 1 ) * limit ) + '&limit=' + limit : null,
              prev:  size && offset !== 0 ? prefix + '/'+keys+'?offset=' + ( prev < 0 ? 0 : prev ) + '&limit=' + limit : null,
              next:  size && next < size  ? prefix + '/'+keys+'?offset=' + next + '&limit=' + limit : null,
              items: collection
            };

        res.json(json);
        res.end();
      });
    });
  },

  getUniqKeys: function(model){
    return _.chain(model)
            .map(function(value, key){
              return value.uniq ? key : undefined;
            })
            .compact()
            .value();
  },

  postInstance: function(key, model){
    var that = this,
        keys = pluralize(key),
        prefix = this.prefix;
    /**
     * Create new instance data and return instance URI with 201 status code
     */

    this.doc({
      method: 'post',
      url : prefix + '/'+keys,
      group: key,
      name: 'Create instance',
      create: true
    });
    this.router.post(prefix + '/'+keys, function(req, res){
      var id,
          text = '',
          uniqKeys = that.getUniqKeys(model),
          texts = _.chain(model)
                   .map(function(value, key){
                     return value.text ? key : undefined;
                   })
                   .compact()
                   .value(),
          md5 = crypto.createHash('md5'),
          params = that.params( model, req ),
          process = [],
          results = validate(model, params);

      if( !results.ok ) {
        res.status(400).json( results );
        return;
      }

      id = uniqKeys.map(function(key){
        var val = params[key];
        return String( val != null ? val : '' ).replace(/[\s\.\/]+/g, '_').toLowerCase();
      }).join('-');

      if(!id){
        md5.update(new Date().getTime() + ':' + Math.random());
        id = md5.digest('hex').substr(0,7);
      }

      text = texts.map(function(key){
        return params[key];
      }).join(' ');

      // Confirm duplicated data existance
      process.push(function(callback){
        that.models[key].findOne({id: id}, function(err, instance){
          callback(instance ? {
            message: 'Duplicate id exists',
            code: 409
          } : null);
        });
      });

      // Confirm parent, instance data existance
      process = process.concat(that.validateRelatedDataExistance(req, model));

      // Push key onto parent object
      process = process.concat(that.getProcessUpdateParent(req, model, that.models[key]));

      process = process.concat([
        function(callback){
          var now = moment().format(),
              Model = that.models[key],
              instance = new Model(
                _.assign({
                    id: id
                }, params, {
                  q: text,
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
        resutils.accessControl(res, req, that.cors);

        if(err) {
          resutils.error(res, err);
          return;
        }
        res.location(prefix + '/'+keys+'/' + id );
        res.status(201).send(null);
      });
    });
  },

  getInstance: function(key, model){
    var that = this,
        keys = pluralize(key),
        fields = this.fields(key),
        prefix = this.prefix;

    /**
     * Get specified instance by ID
     */

    this.doc({
      method: 'get',
      url : prefix + '/'+keys+'/:id',
      group: key,
      name: 'Get instance',
      model: model
    });
    this.router.get(prefix + '/'+keys + '/:id', function(req, res){
      var id = req.params.id;

      async.waterfall([
        function(callback){
          var reqFields = req.query.fields;

          that.models[key].findOne({
            id: id
          }, reqFields ? reqFields.replace(/,/g, ' ') + ' -_id' : fields, function( err, instance ){
            if( !instance ) {
              err = {
                err: {
                  id: 'Specified ID (' + id + ') does not exists in ' + key
                },
                code: 404
              };
            }

            callback(err, instance ? instance : {});
          });
        }
      ], function done(err, instance){
        resutils.accessControl(res, req, that.cors);
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
        parentKeys = pluralize(parentKey),
        keys = pluralize(attr.relation),
        fields = this.fields(key),
        prefix = this.prefix;

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
    this.doc({
      method: 'get',
      url : prefix + '/'+parentKeys+'/:id/'+key,
      group: parentKey,
      name: 'Get '+key+' collection',
      collection: true
    });
    this.router.get(prefix + '/'+parentKeys+'/:id/'+key, function(req, res){
      var id = req.params.id,
          offset = Number(req.query.offset || 0),
          limit = Number(req.query.limit || 25),
          prev = offset - limit,
          next = offset + limit,
          cond = that.cond(model, req);

      delete cond.id;
      cond[parentKey] = id;

      async.waterfall([
        function(callback){
          var reqFields = req.query.fields;

          that.models[attr.relation].find(cond, reqFields ? reqFields.replace(/,/g, ' ') + ' -_id' : fields, {
            skip: offset,
            limit: limit
          }, function(err, collection){
            callback(err, collection);
          });
        },
        function(collection, callback){

          that.models[attr.relation].count(cond, function(err, size){
            callback(err, collection, size);
          });
        }
      ], function done(err, collection, size){
        resutils.accessControl(res, req, that.cors);

        if(err) {
          resutils.error(res, err);
          return;
        }

        collection = that.href(model, keys, collection);

        var json = {
              offset: offset,
              limit: limit,
              size: size,
              first: size                 ? prefix + '/'+parentKeys+'/'+id+'/'+key+'?offset=0&limit='+limit : null,
              last:  size                 ? prefix + '/'+parentKeys+'/'+id+'/'+key+'?offset='+ ( ( Math.ceil( size / limit ) - 1 ) * limit ) + '&limit='+limit : null,
              prev:  size && offset !== 0 ? prefix + '/'+parentKeys+'/'+id+'/'+key+'?offset='+ ( prev < 0 ? 0 : prev ) + '&limit='+limit : null,
              next:  size && next < size  ? prefix + '/'+parentKeys+'/'+id+'/'+key+'?offset='+ next + '&limit='+limit : null,
              items: collection
            };

        res.json(json);
        res.end();
      });

    });

  },


  putAsUpdate: function(key, model){
    var that = this,
        keys = pluralize(key),
        prefix = this.prefix;

    /**
     * Update instance as full replacement with specified ID
     */
    this.doc({
      method: 'put',
      url : prefix + '/'+keys+'/:id',
      group: key,
      name: 'Update instance'
    });
    this.router.put(prefix + '/' + keys + '/:id', function(req, res){
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
        resutils.accessControl(res, req, that.cors);

        if(err) {
          resutils.error(res, err);
          return;
        }

        res.status(200).send(null);
      });
    });
  },

  validatePermission: function(model, params){
    var uniqKeys = this.getUniqKeys(model),
        result = {
          ok: true
        };

    uniqKeys.map(function(key){
      if( params[key] !== undefined ) {
        delete result.ok;
        result[key] = 'uniq key could not be changed';
      }
    });

    return result;
  },

  postAsUpdate: function(key, model){
    var that = this,
        keys = pluralize(key),
        prefix = this.prefix;

    /**
     * Update instance as partial replacement with specified ID
     */
    this.doc({
      method: 'post',
      url : prefix + '/'+keys+'/:id',
      group : key,
      name: 'Update instance'
    });
    this.router.post(prefix + '/' + keys + '/:id', function(req, res){
      var params = that.params( model, req ),
          results = [
            that.validatePermission( model, params ),
            validate(model, params, true)
          ],
          isValid = true;

      results.map(function(result){
        if( isValid && !result.ok ) {
          res.status(400).json( result );
          isValid = false;
        }
      });

      if (! isValid ){
        return;
      }

      async.waterfall(
        // Confirm parent, instance data existance
        that.validateRelatedDataExistance(req, model).concat([
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
        ]).concat(that.getProcessUpdateParent(req, model, that.models[key])), function done(err, instance){
        resutils.accessControl(res, req, that.cors);

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
        keys = pluralize(key),
        prefix = this.prefix;

    /**
     * Delete all collection
     * @return
     */
    this.doc({
      method: 'delete',
      url : prefix + '/'+keys,
      group: key,
      name: 'Delete collection',
      collection: true
    });
    this.router.delete(prefix + '/'+keys, function(req, res){
      async.waterfall([
        function(callback){
          var cond = that.cond(model, req);

          that.models[key].find(cond, function(err, collection){
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
        resutils.accessControl(res, req, that.cors);

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
        keys = pluralize(key),
        prefix = this.prefix;

    /**
     * Delete specified instance
     * @return
     */
    this.doc({
      method: 'delete',
      url : prefix + '/'+keys+'/:id',
      group: key,
      name: 'Delete instance'
    });
    this.router.delete(prefix + '/'+keys+'/:id', function(req, res){
      async.waterfall([
        function(callback){
          that.models[key].findOneAndRemove({
            id: req.params.id
          }, function(err){
            callback(err);
          });
        }
      ], function done(err, instance){
        resutils.accessControl(res, req, that.cors);

        if(err) {
          resutils.error(res, err);
          return;
        }

        res.status(200).send(null);
      });

    });
  },

  validate: function(key, model){
    var that = this,
        keys = pluralize(key),
        prefix = this.prefix;
    /**
     * Validate parameters
     */

    this.doc({
      method: 'get',
      url : prefix + '/validate/'+keys,
      group: key,
      name: 'Validate parameters',
      validate: true
    });
    this.router.get(prefix + '/validate/'+keys, function(req, res){
      var params = that.params( model, req ),
          results = validate( model, params );

      res.status( results.ok ? 200 : 400).json( results );
    });
  },

  unroute: function(){
    var router = this.router;
    var paths = router.stack.map(function(layer){
      return layer.route.path;
    });

    _.uniq(paths).map(function(path){
      unroute.remove(router, path);
    });
  }

};

module.exports = Creator;
