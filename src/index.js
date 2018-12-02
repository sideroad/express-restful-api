import express from 'express';
import _ from 'lodash';
import Creator from './creator';

module.exports = {
  router: function routerFn(options) {
    const router = express.Router();
    const {
      schemas, prefix, before, after, client, secret,
    } = options;
    const applyChildren = (creator, key, schema, model) => {
      _.each(model, (attr, childKey) => {
        if (attr.type === 'children') {
          creator.getChildren(key, attr, childKey, schema[attr.relation]);
        }
      });
    };

    const creator = new Creator({
      connectionString: options.mongo,
      router,
      prefix,
      before,
      after,
      client,
      secret,
      schemas
    });

    Object.keys(schemas).forEach((key) => {
      const model = schemas[key];
      creator.model(key, model);
      creator.getInstance(key, model);
      creator.getCollection(key, model);
      applyChildren(creator, key, schemas, model);

      creator.postInstanceOrCollection(key, model);
      creator.postOrPatchAsUpdate(key, model);

      creator.deleteCollection(key, model);
      creator.deleteInstance(key, model);
    });
    this.creator = creator;
    return router;
  },
  doc: function docFn(doc) {
    this.creator.createDoc(doc);
  },
  destroy: function destroyFn() {
    this.creator.unroute();
  }
};
