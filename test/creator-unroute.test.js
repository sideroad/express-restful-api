import should from 'should';
import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import async from 'async';
import request from 'supertest';
import Creator from '../lib/creator';

const app = express();
const router = express.Router();
const schema = {
  company: {
    name: {
      uniq: true,
      pattern: /^[a-zA-Z 0-9]+$/,
      invalid: 'Only alphabets number spaces allowed',
    },
    members: {
      type: 'children',
      relation: 'person',
    },
    president: {
      type: 'instance',
      relation: 'person',
    },
    location: {
      type: 'string',
      pattern: /^[a-zA-Z]+$/,
      invalid: 'Only alphabets allowed',
    },
  },
  person: {
    name: {
      uniq: true,
      text: true,
    },
    company: {
      type: 'parent',
      relation: 'company.members',
      text: true,
    },
    age: {
      type: 'number',
    },
  },
  holiday: {
    name: {
      uniq: true,
      text: true,
    },
    start: {
      type: 'date',
    },
    end: {
      type: 'date',
    },
  },
};

let creator;

describe('Creator Unroute', () => {
  before(() => {
    mongoose.connect(process.env.MONGO_URL);
    mongoose.models = {};
    mongoose.modelSchemas = {};
    creator = new Creator({ mongoose, router, prefix: '/api' });
    app.use(bodyParser.json());
    app.use(router);

    creator.model('company', schema.company);
    creator.getInstance('company', schema.company);
    creator.getCollection('company', schema.company);
    creator.getChildren('company', { type: 'children', relation: 'person' }, 'members', schema.person);
    creator.postInstance('company', schema.company);
    creator.deleteCollection('company', schema.company);

    creator.model('person', schema.person);
    creator.getInstance('person', schema.person);
    creator.getCollection('person', schema.person);
    creator.postInstance('person', schema.person);
    creator.deleteCollection('person', schema.person);

    creator.model('holiday', schema.holiday);
    creator.getInstance('holiday', schema.holiday);
    creator.getCollection('holiday', schema.holiday);
    creator.postInstance('holiday', schema.holiday);
    creator.deleteCollection('holiday', schema.holiday);
  });

  after(() => {
    mongoose.disconnect();
  });

  it('should unroute router', (done) => {
    creator.unroute();
    async.waterfall([
      (callback) => {
        request(app)
          .get('/api/companies')
          .expect(404)
          .end((err) => {
            should.not.exist(err);
            callback();
          });
      },
    ], (err) => {
      done(err);
    });
  });
});
