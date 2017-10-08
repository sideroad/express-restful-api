import _ from 'lodash';
import moment from 'moment';
import async from 'async';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import apidoc from 'apidoc';
import pluralize from 'pluralize';
import camelize from 'camelize';
import unroute from 'unroute';
import validate from './validate';
import resutils from './resutils';

const Creator = function constructor({
  mongoose, router, prefix, before, after, client, secret, schemas,
}) {
  this.mongoose = mongoose;
  this.mongooseModels = {};
  this.mongooseSchemas = {};
  this.router = router;
  this.prefix = prefix || '';
  this.schemas = schemas;
  this.requestAttrs = {};
  this.responseAttrs = {};
  this.docs = [];
  this.docOrder = [];
  this.auth = client && secret ? (req, res, next) => {
    if (req.headers['x-chaus-secret'] === secret &&
        req.headers['x-chaus-client'] === client) {
      next();
    } else {
      resutils.error(res, {
        code: 400,
        message: 'x-chaus-secret and / or x-chaus-client header are invalid',
      });
    }
  } : (req, res, next) => {
    next();
  };
  this.before = before ? (req, res, next, key) => {
    before(req, res, next, key, this.mongooseModels);
  } : (req, res, next) => {
    next();
  };
  this.after = after ? (req, res, json, key) => {
    after(req, res, json, key, this.mongooseModels);
  } : (req, res, json) => {
    if (json) {
      res.json(json);
    } else {
      res.send(null).end();
    }
  };
};

Creator.prototype = {
  createDoc: function createDocfn(_doc) {
    const doc = _.assign({
      order: this.docOrder,
    }, _doc);
    const source = path.join(doc.dest, 'apicomment.js');

    if (fs.existsSync(source)) {
      fs.unlinkSync(source);
    }

    fs.mkdirsSync(doc.dest);
    fs.writeFileSync(path.join(doc.dest, 'apidoc.json'), JSON.stringify(doc));
    fs.writeFileSync(source, this.docs.join('\n'));

    apidoc.createDoc({
      src: doc.dest,
      dest: doc.dest,
      config: doc.dest,
    });

    // apply patch for doc sample ajax
    fs.copySync(path.join(__dirname, '../patch/send_sample_request.js'), path.join(doc.dest, 'utils/send_sample_request.js'));
  },

  doc: function docfn(doc) {
    const group = doc.group.substr(0, 1).toUpperCase() + doc.group.substr(1);
    const responseAttrs = this.responseAttrs;
    const requestAttrs = this.requestAttrs;
    const mongooseSchemas = this.mongooseSchemas;
    const apiName = camelize(group + doc.name.replace(/\s+/g, '_'));
    const getApiParam = () => {
      let params = [];

      if (doc.method === 'post' ||
          doc.collection ||
          doc.validate) {
        params = params.concat(
          _.map(requestAttrs[doc.group], (attr, key) =>
            (
              attr.type === 'children' ? '' :
              `@apiParam {${
                attr.type === 'number' ? 'Number' :
                attr.type === 'boolean' ? 'Boolean' : 'String'
              }} ${[
                (doc.create && (attr.required || attr.uniq) ? key : `[${key}]`),
                (doc.create && attr.default ? `=${attr.default}` : ''),
                (attr.desc ? attr.desc : attr.type === 'instance' ? `${attr.relation} id` : ''),
              ].join(' ')}`
            ),
          ),
        );
      }

      if (doc.method === 'get' &&
          !doc.validate) {
        params.push('@apiParam {String} [fields] Pertial attribution will be responsed.');
        params.push('Attributions should be separated with comma.');
      }

      if (doc.method === 'get' &&
          doc.collection) {
        params.push('@apiParam {String} [expands] Expand specified `parent`, `instance` fields.');
        params.push('`children` field could not expanded.');
        params.push('@apiParam {String} [orderBy] Specify sort order of fetched collection.');
        params.push('For example `orderBy=+name,-age`');
      }

      if (doc.params) {
        params = _.map(doc.params, (value, key) =>
          `@apiParam {String} ${key} ${value}`,
        );
      }
      return params.join('\n * ');
    };
    const apiSuccess = doc.response ?
      _.map(doc.response, (value, key) =>
        `@apiSuccess {String} ${key} ${value}`,
      ) :
      doc.method !== 'get' ? '' :
      doc.collection ? [
        '@apiSuccess {Number} offset',
        '@apiSuccess {Number} limit',
        '@apiSuccess {Number} size',
        '@apiSuccess {String} first',
        '@apiSuccess {String} last',
        '@apiSuccess {String} prev',
        '@apiSuccess {String} next',
        `@apiSuccess {Object[]} items Array of ${group} instance`,
      ].join('\n * ') :
      _.map(mongooseSchemas[doc.group], (schema, key) => {
        const attr = responseAttrs[doc.group][key] || {};
        if (
          doc.validate &&
          (key === 'id' ||
           key === 'createdAt' ||
           key === 'updatedAt' ||
           attr.type === 'children')
        ) {
          return '';
        }
        return `@apiSuccess {${
          (attr.type === 'number' ? 'Number' :
            attr.type === 'boolean' ? 'Boolean' :
            attr.type === 'children' ? 'Object' :
            attr.type === 'instance' ? 'Object' : 'String')
        }} ${key} ${
          (attr.desc ? attr.desc :
            attr.type === 'children' ? `linking of ${attr.relation}` :
            attr.type === 'instance' ? `linking of ${attr.relation}` : '')
        }`;
      }).join('\n * ');
    const apiHeader = !doc.headers ? '' : _.map(doc.headers, (value, header) =>
      `@apiHeader {String} ${header} ${value}`,
    );

    this.docs.push(
      `
/**
 * @api {${doc.method}} ${doc.url} ${doc.name}
 * @apiName ${apiName}
 * @apiGroup ${group}
 * ${getApiParam()}
 * ${apiSuccess}
 * ${apiHeader}
 */`,
    );
    this.docOrder.push(apiName);
  },

  model: function modelFn(key, _attrs) {
    const schemaType = {};
    const attrs = _.assign({
      id: {},
    }, _attrs, {
      createdAt: {
        type: 'date',
      },
      updatedAt: {
        type: 'date',
      },
    });

    _.each(attrs, (attr, name) => {
      const type = attr.type === 'number' ? Number :
        attr.type === 'boolean' ? Boolean :
        attr.type === 'date' ? Date :
        attr.type === 'children' ? Array : String;

      schemaType[name] = {
        type,
        default: attr.default || null,
      };
    });

    const schema = new this.mongoose.Schema(_.assign({
      q: String,
    }, schemaType), { minimize: false });
    schema.index({ id: 1 });

    const model = this.mongoose.model((this.prefix + key).replace(/\//g, '_'), schema);
    this.mongooseModels[key] = model;
    this.mongooseSchemas[key] = schemaType;
    this.responseAttrs[key] = attrs;
    this.requestAttrs[key] = _attrs;
  },

  parseOrder: function parseOrderFn(orderBy = '') {
    const sort = {};
    orderBy.split(',').forEach((set) => {
      if (!set) {
        return;
      }
      const operand = set.match(/^(\+|-|)(.+)/);
      const key = operand ? operand[2] : set;
      sort[key] = operand && operand[1] === '-' ? -1 : 1;
    });
    return sort;
  },

  fields: function fieldsFn(key, params) {
    const fields = _.map(params || this.mongooseSchemas[key], (attr, name) =>
      name,
    ).join(' ');
    return `${fields} -_id`;
  },

  params: function paramsFn(model, req) {
    const params = {};
    _.map(model, (option, key) => {
      let value = req.body[key] !== undefined ? req.body[key] :
        req.params[key] !== undefined ? req.params[key] :
        req.query[key] !== undefined &&
        req.query[key] !== null &&
        req.query[key] !== '' ? req.query[key] : undefined;

      if (option.type === 'children') {
        value = value !== undefined ? value : [];
      }

      if (
        _.isArray(value) ? value.length :
        value !== undefined
      ) {
        params[key] = value;
      }
    });
    return params;
  },

  cond: function condFn(model, req) {
    const params = this.params(Object.assign({ id: { type: 'string' } }, model), req);
    const cond = {};

    _.each(params, (_val, key) => {
      const type = (model[key] || {}).type;
      const search = type === 'number' || type === 'date' ? 'range' : 'wildcard';

      const val = _val && _val.length ? _val : '';
      cond[key] = search === 'wildcard' && /\*/.test(val) ?
        new RegExp(`^${
          val.replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]')
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
        }$`) :
        search === 'range' && /^\[.+,.+\]$/.test(val) ?
          {
            $gte: val.match(/^\[(.+),(.+)\]$/)[1],
            $lte: val.match(/^\[(.+),(.+)\]$/)[2],
          } :
          /,/.test(val) ? {
            $in: val.split(','),
          } : val;
    });

    if (req.query.q) {
      cond.q = new RegExp(req.query.q);
    }
    return cond;
  },

  toObject: function toObjectFn(collection) {
    return _.map(collection, instance =>
      (instance.toObject ? instance.toObject() : instance),
    );
  },

  makeRelation: function makeRelationFn(model, collectionKey, _collection, expands, callback) {
    const prefix = this.prefix;
    const collection = this.toObject(_collection);
    async.map(Object.keys(model), (key, modelCallback) => {
      const option = model[key];

      switch (option.type) {
      case 'children':
        collection.forEach((instance) => {
          if (instance.hasOwnProperty(key)) {
            // eslint-disable-next-line no-param-reassign
            instance[key] = {
              href: `${prefix}/${collectionKey}/${instance.id}/${key}`,
            };
          }
        });
        modelCallback();
        break;
      case 'parent':
        async.map(collection, (instance, collectionCallback) => {
          if (instance.hasOwnProperty(key)) {
            const instanceKey = option.relation.split('.')[0];
            const parentCollectionKey = pluralize(instanceKey);
            if (expands.includes(key)) {
              this.mongooseModels[instanceKey].findOne({
                id: instance[key],
              }, this.fields(instanceKey), (err, res) => {
                this.makeRelation(
                  this.schemas[instanceKey],
                  parentCollectionKey,
                  [res],
                  [],
                  (parentCollection) => {
                    // eslint-disable-next-line no-param-reassign
                    instance[key] = parentCollection[0];
                    collectionCallback();
                  },
                );
              });
            } else {
              // eslint-disable-next-line no-param-reassign
              instance[key] = {
                href: `${prefix}/${parentCollectionKey}/${instance[key]}`,
                id: instance[key],
              };
              collectionCallback();
            }
          } else {
            collectionCallback();
          }
        }, () => {
          modelCallback();
        });
        break;
      case 'instance':
        async.map(collection, (instance, collectionCallback) => {
          if (instance.hasOwnProperty(key)) {
            const instanceKey = option.relation;
            const parentCollectionKey = pluralize(instanceKey);
            if (expands.includes(key)) {
              this.mongooseModels[instanceKey].findOne({
                id: instance[key],
              }, this.fields(instanceKey), (err, res) => {
                this.makeRelation(
                  this.schemas[instanceKey],
                  parentCollectionKey,
                  [res],
                  [],
                  (instanceCollection) => {
                    // eslint-disable-next-line no-param-reassign
                    instance[key] = instanceCollection[0];
                    collectionCallback();
                  },
                );
              });
            } else {
              // eslint-disable-next-line no-param-reassign
              instance[key] = {
                href: instance[key] ? `${prefix}/${pluralize(instanceKey)}/${instance[key]}` : null,
                id: instance[key],
              };
              collectionCallback();
            }
          } else {
            collectionCallback();
          }
        }, () => {
          modelCallback();
        });
        break;
      default:
        modelCallback();
      }
    }, () => {
      callback(collection);
    });
  },

  validateRelatedDataExistance: function validateRelatedDataExistanceFn(req, schema) {
    const process = [];
    _.each(schema, (attr, name) => {
      let key;

      if (attr.type === 'parent') {
        key = attr.relation.split('.')[0];
      }
      if (attr.type === 'instance') {
        key = attr.relation;
      }
      const id = req.body[name];
      if (key && id) {
        process.push(
          (callback) => {
            this.mongooseModels[key].findOne({
              id,
            }, (err, instance) => {
              callback(!instance ? {
                err: {
                  [name]: `Specified ID (${id}) does not exists in ${key}`,
                },
                code: 400,
              } : err);
            });
          },
        );
      }
    });
    return process;
  },

  getProcessUpdateParent: function getProcessUpdateParentFn(req, schema, model) {
    const process = [];
    _.each(schema, (attr) => {
      if (attr.type === 'parent') {
        const key = attr.relation.split('.')[0];
        const child = attr.relation.split('.')[1];

        process.push(
          (callback) => {
            model.findOne({
              id: req.body[key],
            }, (err, parent) => {
              callback(err, parent);
            });
          });
        process.push(
          (parent, callback) => {
            if (parent) {
              const now = moment().format();
              parent[child].push(undefined); // TODO Confirm the logic is need or not.
              // eslint-disable-next-line no-param-reassign
              parent.updatedAt = now;
              parent.save((err) => {
                callback(err);
              });
            } else {
              callback(null);
            }
          },
        );
      }
    });
    return process;
  },

  getJsonSchema: function getJsonSchemaFn(_key, model) {
    const json = {
      properties: {},
      required: [],
    };

    Object.keys(model).forEach((key) => {
      const attr = model[key];
      json.properties[key] = {
        type: attr.type === 'number' ? 'number' : attr.type === 'boolean' ? 'boolean' : 'string',
      };
      if (attr.type === 'date') {
        json.properties[key].format = 'date';
      }
      if (attr.pattern) {
        json.properties[key].pattern = new RegExp(attr.pattern).toString();
      }
      if (attr.uniq || attr.required) {
        json.required.push(key);
      }
    });

    return json;
  },

  getCollection: function getCollectionFn(key, model) {
    const keys = pluralize(key);
    const fields = this.fields(key);
    const prefix = this.prefix;
    const before = this.before;
    const after = this.after;

    /**
     * Return collection
     * @return {List of group object }
     */
    this.doc({
      method: 'get',
      url: `${prefix}/${keys}`,
      group: key,
      name: 'Get collection',
      collection: true,
    });
    this.doc({
      method: 'get',
      url: `${prefix}/${keys}`,
      group: key,
      params: {},
      response: {},
      name: 'Get JSON Schema',
      headers: {
        'X-JSON-Schema': 'When the header has <code>true</code>, response JSON Schema instead',
      },
    });
    this.doc({
      method: 'get',
      url: `${prefix}/${keys}`,
      group: key,
      name: 'Validate parameters',
      validate: true,
      headers: {
        'X-Validation': 'When the header has <code>true</code>, validate parameters',
      },
    });

    this.router.get(
      `${prefix}/${keys}`,
      this.auth,
      (req, res, next) => {
        before(req, res, next, key);
      },
      (req, res, next) => {
        if (req.headers['x-json-schema'] === 'true') {
          res.status(200).json(this.getJsonSchema(key, model)).end();
        } else {
          next();
        }
      },
      (req, res, next) => {
        if (req.headers['x-validation'] === 'true') {
          async.waterfall(this.validateRelatedDataExistance(req, model), (err) => {
            const params = this.params(model, req);
            const results = validate(model, params);
            if (err) {
              resutils.error(res, err);
            } else {
              res.status(results.ok ? 200 : 400).json(results).end();
            }
          });
        } else {
          next();
        }
      },
      (req, res) => {
        const offset = Number(req.query.offset || 0);
        const limit = Number(req.query.limit || 25);
        const cond = this.cond(model, req);
        const prev = offset - limit;
        const next = offset + limit;

        async.waterfall([
          (callback) => {
            const reqFields = req.query.fields;

            this.mongooseModels[key].find(cond, reqFields ? `${reqFields.replace(/,/g, ' ')} -_id` : fields, {
              skip: offset,
              limit,
              sort: this.parseOrder(req.query.orderBy),
            }, (err, collection) => {
              callback(err, collection);
            });
          },
          (collection, callback) => {
            this.mongooseModels[key].count(cond, (err, size) => {
              callback(err, collection, size);
            });
          },
        ], (err, collection, size) => {
          if (err) {
            resutils.error(res, err);
            return;
          }

          this.makeRelation(
            model,
            keys,
            collection,
            (req.query.expands || '').split(','),
            (items) => {
              after(req, res, {
                offset,
                limit,
                size,
                first: size ? `${prefix}/${keys}?offset=0&limit=${limit}` : null,
                last: size ? `${prefix}/${keys}?offset=${((Math.ceil(size / limit) - 1) * limit)}&limit=${limit}` : null,
                prev: size && offset !== 0 ? `${prefix}/${keys}?offset=${(prev < 0 ? 0 : prev)}&limit=${limit}` : null,
                next: size && next < size ? `${prefix}/${keys}?offset=${next}&limit=${limit}` : null,
                items,
              }, key);
            },
          );
        });
      },
    );
  },

  getUniqKeys: function getUniqKeysFn(model) {
    return _.chain(model)
      .map((value, key) =>
        (value.uniq ? key : undefined),
      )
      .compact()
      .value();
  },

  postInstance: function postInstanceFn(key, model) {
    const keys = pluralize(key);
    const prefix = this.prefix;
    const before = this.before;
    const after = this.after;
    /**
     * Create new instance data and return instance URI with 201 status code
     */

    this.doc({
      method: 'post',
      url: `${prefix}/${keys}`,
      group: key,
      name: 'Create instance',
      create: true,
    });
    this.router.post(
      `${prefix}/${keys}`,
      this.auth,
      (req, res, next) => {
        before(req, res, next, key);
      },
      (req, res) => {
        const uniqKeys = this.getUniqKeys(model);
        const texts = _.chain(model)
          .map((value, _key) =>
            (value.text ? _key : undefined),
          )
          .compact()
          .value();
        const md5 = crypto.createHash('md5');
        const params = this.params(model, req);
        const results = validate(model, params);

        let process = [];
        let id;
        let text = '';

        if (!results.ok) {
          res.status(400).json(results);
          return;
        }

        if (uniqKeys.length === 1) {
          const val = params[uniqKeys[0]];
          id = String(val != null ? val : '').replace(/[\s./]+/g, '_').toLowerCase();
          if (!/^[a-z_0-9-]+$/.test(id)) {
            md5.update(id);
            id = md5.digest('hex').substr(0, 7);
          }
        } else if (uniqKeys.length) {
          md5.update(uniqKeys.map((uniqKey) => {
            const val = params[uniqKey];
            return String(val != null ? val : '').replace(/[\s./]+/g, '_').toLowerCase();
          }).join('-'));
          id = md5.digest('hex').substr(0, 7);
        } else {
          md5.update(`${new Date().getTime()}:${Math.random()}`);
          id = md5.digest('hex').substr(0, 7);
        }

        text = texts.map(textString =>
          params[textString],
        ).join(' ');

        // Confirm duplicated data existance
        process.push((callback) => {
          this.mongooseModels[key].findOne({ id }, (err, instance) => {
            callback(instance ? {
              message: 'Duplicate id exists',
              code: 409,
            } : null);
          });
        });

        // Confirm parent, instance data existance
        process = process.concat(this.validateRelatedDataExistance(req, model));

        // Push key onto parent object
        process = process.concat(this.getProcessUpdateParent(req, model, this.mongooseModels[key]));

        process = process.concat([
          (callback) => {
            const now = moment().format();
            const Model = this.mongooseModels[key];
            const instance = new Model(
              _.assign({
                id,
              }, params, {
                q: text,
                createdAt: now,
                updatedAt: now,
              }),
            );

            instance.save((err) => {
              callback(err);
            });
          },
        ]);

        async.waterfall(process, (err) => {
          if (err) {
            resutils.error(res, err);
            return;
          }
          const href = `${prefix}/${keys}/${id}`;
          res.location(href);
          res.status(201);
          after(req, res, {
            id,
            href,
          }, key);
        });
      },
    );
  },

  getInstance: function getInstanceFn(key, model) {
    const keys = pluralize(key);
    const fields = this.fields(key);
    const prefix = this.prefix;
    const before = this.before;
    const after = this.after;

    /**
     * Get specified instance by ID
     */

    this.doc({
      method: 'get',
      url: `${prefix}/${keys}/:id`,
      group: key,
      name: 'Get instance',
      model,
    });
    this.router.get(
      `${prefix}/${keys}/:id`,
      this.auth,
      (req, res, next) => {
        before(req, res, next, key);
      },
      (req, res) => {
        const id = req.params.id;

        async.waterfall([
          (callback) => {
            const reqFields = req.query.fields;

            this.mongooseModels[key].findOne({
              id,
            }, reqFields ? `${reqFields.replace(/,/g, ' ')} -_id` : fields, (err, instance) => {
              callback(!instance ? {
                err: {
                  id: `Specified ID (${id}) does not exists in ${key}`,
                },
                code: 404,
              } : err, instance || {});
            });
          },
        ], (err, instance) => {
          if (err) {
            resutils.error(res, err);
            return;
          }

          this.makeRelation(
            model,
            keys,
            [instance],
            (req.query.expands || '').split(','),
            (instanceCollection) => {
              after(req, res, instanceCollection[0], key);
            },
          );
        });
      },
    );
  },

  getChildren: function getChildrenFn(parentKey, attr, key, model) {
    const parentKeys = pluralize(parentKey);
    const keys = pluralize(attr.relation);
    const fields = this.fields(key);
    const prefix = this.prefix;
    const before = this.before;
    const after = this.after;

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
      url: `${prefix}/${parentKeys}/:id/${key}`,
      group: parentKey,
      name: `Get ${key} collection`,
      collection: true,
    });
    this.router.get(
      `${prefix}/${parentKeys}/:id/${key}`,
      this.auth,
      (req, res, next) => {
        before(req, res, next, key);
      },
      (req, res) => {
        const id = req.params.id;
        const offset = Number(req.query.offset || 0);
        const limit = Number(req.query.limit || 25);
        const prev = offset - limit;
        const next = offset + limit;
        const cond = this.cond(model, req);

        delete cond.id;
        cond[parentKey] = id;

        async.waterfall([
          (callback) => {
            const reqFields = req.query.fields;

            this.mongooseModels[attr.relation].find(cond, reqFields ? `${reqFields.replace(/,/g, ' ')} -_id` : fields, {
              skip: offset,
              limit,
              sort: this.parseOrder(req.query.orderBy),
            }, (err, collection) => {
              callback(err, collection);
            });
          },
          (collection, callback) => {
            this.mongooseModels[attr.relation].count(cond, (err, size) => {
              callback(err, collection, size);
            });
          },
        ], (err, collection, size) => {
          if (err) {
            resutils.error(res, err);
            return;
          }

          this.makeRelation(model, keys, collection, (req.query.expands || '').split(','), (items) => {
            after(req, res, {
              offset,
              limit,
              size,
              first: size ? `${prefix}/${parentKeys}/${id}/${key}?offset=0&limit=${limit}` : null,
              last: size ? `${prefix}/${parentKeys}/${id}/${key}?offset=${((Math.ceil(size / limit) - 1) * limit)}&limit=${limit}` : null,
              prev: size && offset !== 0 ? `${prefix}/${parentKeys}/${id}/${key}?offset=${(prev < 0 ? 0 : prev)}&limit=${limit}` : null,
              next: size && next < size ? `${prefix}/${parentKeys}/${id}/${key}?offset=${next}&limit=${limit}` : null,
              items,
            }, key);
          });
        });
      },
    );
  },

  putAsUpdate: function putAsUpdateFn(key, model) {
    const keys = pluralize(key);
    const prefix = this.prefix;
    const before = this.before;
    const after = this.after;

    /**
     * Update instance as full replacement with specified ID
     */
    this.doc({
      method: 'put',
      url: `${prefix}/${keys}/:id`,
      group: key,
      name: 'Update instance',
    });
    this.router.put(
      `${prefix}/${keys}/:id`,
      this.auth,
      (req, res, next) => {
        before(req, res, next, key);
      },
      (req, res) => {
        const params = this.params(model, req);

        async.waterfall([
          (callback) => {
            const now = moment().format();

            this.mongooseModels[key].findOneAndUpdate({
              id: req.params.id,
            }, _.assign(params, {
              updatedAt: now,
            }), (err) => {
              callback(err);
            });
          },
        ], (err) => {
          if (err) {
            resutils.error(res, err);
            return;
          }
          after(req, res, {}, key);
        });
      },
    );
  },

  validatePermission: function validatePermissionFn(model, params) {
    const uniqKeys = this.getUniqKeys(model);
    const result = {
      ok: true,
    };

    uniqKeys.forEach((key) => {
      if (params[key] !== undefined) {
        delete result.ok;
        result[key] = 'uniq key could not be changed';
      }
    });

    return result;
  },

  postOrPatchAsUpdate: function postOrPatchAsUpdateFn(key, model) {
    const keys = pluralize(key);
    const prefix = this.prefix;
    const before = this.before;
    const after = this.after;

    /**
     * Update instance as partial replacement with specified ID
     */
    this.doc({
      method: 'post',
      url: `${prefix}/${keys}/:id`,
      group: key,
      name: 'Update instance',
    });
    const routes = [
      `${prefix}/${keys}/:id`,
      this.auth,
      (req, res, next) => {
        before(req, res, next, key);
      },
      (req, res) => {
        const params = this.params(model, req);
        const results = [
          this.validatePermission(model, params),
          validate(model, params, true),
        ];
        let isValid = true;

        results.forEach((result) => {
          if (isValid && !result.ok) {
            res.status(400).json(result);
            isValid = false;
          }
        });

        if (!isValid) {
          return;
        }

        async.waterfall(
          // Confirm parent, instance data existance
          this.validateRelatedDataExistance(req, model).concat([
            (callback) => {
              const now = moment().format();

              this.mongooseModels[key].findOneAndUpdate({
                id: req.params.id,
              }, _.assign(params, {
                updatedAt: now,
              }), (err) => {
                callback(err);
              });
            },
          ]).concat(this.getProcessUpdateParent(req, model, this.mongooseModels[key])), (err) => {
            if (err) {
              resutils.error(res, err);
              return;
            }
            after(req, res, null, key);
          },
        );
      },
    ];
    this.router.post(...routes);
    this.router.patch(...routes);
  },

  deleteCollection: function deleteCollectionFn(key, model) {
    const keys = pluralize(key);
    const prefix = this.prefix;
    const before = this.before;
    const after = this.after;

    /**
     * Delete all collection
     * @return
     */
    this.doc({
      method: 'delete',
      url: `${prefix}/${keys}`,
      group: key,
      name: 'Delete collection',
      collection: true,
    });
    this.router.delete(
      `${prefix}/${keys}`,
      this.auth,
      (req, res, next) => {
        before(req, res, next, key);
      },
      (req, res) => {
        async.waterfall([
          (callback) => {
            const cond = this.cond(model, req);

            this.mongooseModels[key].find(cond, (findErr, collection) => {
              async.map(collection, (instance, modelCallback) => {
                instance.remove((err) => {
                  modelCallback(err);
                });
              }, (err) => {
                callback(err);
              });
            });
          },
        ], (err) => {
          if (err) {
            resutils.error(res, err);
            return;
          }
          after(req, res, null, key);
        });
      },
    );
  },

  deleteInstance: function deleteInstanceFn(key) {
    const keys = pluralize(key);
    const prefix = this.prefix;
    const before = this.before;
    const after = this.after;

    /**
     * Delete specified instance
     * @return
     */
    this.doc({
      method: 'delete',
      url: `${prefix}/${keys}/:id`,
      group: key,
      name: 'Delete instance',
    });
    this.router.delete(
      `${prefix}/${keys}/:id`,
      this.auth,
      (req, res, next) => {
        before(req, res, next, key);
      },
      (req, res) => {
        async.waterfall([
          (callback) => {
            this.mongooseModels[key].findOneAndRemove({
              id: req.params.id,
            }, (err) => {
              callback(err);
            });
          },
        ], (err) => {
          if (err) {
            resutils.error(res, err);
            return;
          }
          after(req, res, null, key);
        });
      },
    );
  },

  unroute: function unrouteFn() {
    const router = this.router;
    const paths = router.stack.map(layer =>
      layer.route.path,
    );

    _.uniq(paths).forEach((routePath) => {
      unroute.remove(router, routePath);
    });
  },

};

module.exports = Creator;
