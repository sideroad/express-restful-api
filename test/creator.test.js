import should from 'should';
import express from 'express';
import fs from 'fs';
import request from 'supertest';
import bodyParser from 'body-parser';
import async from 'async';
import mongoose from 'mongoose';
import path from 'path';
import Creator from '../src/creator';

mongoose.Promise = Promise;

const router = express.Router();
const app = express();
const prefix = '/api';
const schemas = {
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
    isStockListing: {
      type: 'boolean',
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

describe('Creator', () => {
  before(() => {
    mongoose.connect(
      process.env.MONGO_URL,
      {
        useMongoClient: true,
      },
    );
    mongoose.models = {};
    mongoose.modelSchemas = {};

    creator = new Creator({ mongoose, router, prefix, schemas });
    app.use(bodyParser.json());
    app.use(router);

    creator.model('company', schemas.company);
    creator.getInstance('company', schemas.company);
    creator.getCollection('company', schemas.company);
    creator.getChildren(
      'company',
      { type: 'children', relation: 'person' },
      'members',
      schemas.person,
    );
    creator.deleteInstance('company', schemas.company);
    creator.postOrPatchAsUpdate('company', schemas.company);
    creator.postInstanceOrCollection('company', schemas.company);
    creator.deleteCollection('company', schemas.company);

    creator.model('person', schemas.person);
    creator.getInstance('person', schemas.person);
    creator.getCollection('person', schemas.person);
    creator.postInstanceOrCollection('person', schemas.person);
    creator.deleteCollection('person', schemas.person);

    creator.model('holiday', schemas.holiday);
    creator.getInstance('holiday', schemas.holiday);
    creator.getCollection('holiday', schemas.holiday);
    creator.postInstanceOrCollection('holiday', schemas.holiday);
    creator.deleteCollection('holiday', schemas.holiday);
  });

  after(() => {
    mongoose.disconnect();
  });

  const cleanup = (callback) => {
    async.mapSeries(
      ['/api/companies', '/api/people', '/api/holidays'],
      (uri, mapCallback) => {
        request(app)
          .delete(uri)
          .expect(200)
          .end((err) => {
            mapCallback(err);
          });
      },
      (err) => {
        should.not.exist(err);
        callback();
      },
    );
  };

  const cleanupWithParameter = (callback) => {
    request(app)
      .delete('/api/companies')
      .send({ name: 'Side' })
      .expect(200)
      .end(() => {
        request(app)
          .delete('/api/people')
          .send({ name: '*side*' })
          .expect(200)
          .end((err) => {
            callback(err);
          });
      });
  };

  const validCompanies = [
    {
      name: 'Side',
      isStockListing: true,
      location: 'Japan',
    },
    {
      name: 'Road',
      isStockListing: false,
      location: 'USA',
    },
  ];

  const invalidCompany = {
    name: 'Invalid_Name',
  };

  const createCompany = (callback) => {
    async.mapSeries(
      validCompanies,
      (data, mapCallback) => {
        request(app)
          .post('/api/companies')
          .type('json')
          .send(data)
          .expect(201)
          .end((err, res) => {
            res.body.should.have.property('id');
            res.body.should.have.property('href');
            mapCallback(err);
          });
      },
      (err) => {
        should.not.exist(err);
        callback();
      },
    );
  };

  const createBulkCompany = (callback) => {
    request(app)
      .post('/api/companies')
      .type('json')
      .send({
        items: validCompanies,
      })
      .expect(201)
      .end((err, res) => {
        should.not.exist(err);
        res.body.should.have.property('items', [
          {
            href: '/api/companies/side',
            id: 'side',
          },
          {
            href: '/api/companies/road',
            id: 'road',
          },
        ]);

        callback(err);
      });
  };

  const createInvalidCompany = (callback) => {
    async.mapSeries(
      [
        invalidCompany,
        {
          name: '',
        },
        {},
      ],
      (data, mapCallback) => {
        request(app)
          .post('/api/companies')
          .type('json')
          .send(data)
          .expect(400)
          .end((err, res) => {
            should.not.exist(err);
            res.body.should.have.property('name', 'Only alphabets number spaces allowed');
            mapCallback(err);
          });
      },
      (err) => {
        should.not.exist(err);
        callback();
      },
    );
  };

  const createBulkInvalidCompany = (callback) => {
    request(app)
      .post('/api/companies')
      .type('json')
      .send({
        items: [
          invalidCompany,
          {
            name: '',
          },
          {},
        ],
      })
      .expect(400)
      .end((err, res) => {
        should.not.exist(err);
        res.body.should.have.property('name', 'Only alphabets number spaces allowed');
        callback(err);
      });
  };

  const createCompanyWithIvalidPresident = (callback) => {
    async.mapSeries(
      [
        {
          name: 'sideroad',
          president: 'notexist',
        },
      ],
      (data, mapCallback) => {
        request(app)
          .post('/api/companies')
          .type('json')
          .send(data)
          .expect(400)
          .end((err, res) => {
            should.not.exist(err);
            res.body.should.have.property(
              'president',
              'Specified ID (notexist) does not exists in person',
            );
            mapCallback(err);
          });
      },
      (err) => {
        should.not.exist(err);
        callback();
      },
    );
  };

  const validateCompany = (callback) => {
    async.mapSeries(
      validCompanies,
      (data, mapCallback) => {
        request(app)
          .post('/api/companies')
          .set('X-Validation', 'true')
          .send(data)
          .expect(200)
          .end((err) => {
            should.not.exist(err);
            mapCallback(err);
          });
      },
      (err) => {
        should.not.exist(err);
        callback();
      },
    );
  };

  const validateBulkCompany = (callback) => {
    request(app)
      .post('/api/companies')
      .set('X-Validation', 'true')
      .send({
        items: validCompanies,
      })
      .expect(200)
      .end((err) => {
        should.not.exist(err);
        callback(err);
      });
  };

  const validateInvalidCompany = (callback) => {
    request(app)
      .post('/api/companies')
      .set('X-Validation', 'true')
      .send(invalidCompany)
      .expect(400)
      .end((err, res) => {
        should.not.exist(err);
        res.body.should.have.property('name', 'Only alphabets number spaces allowed');
        res.body.should.have.property('index', 0);
        callback(err);
      });
  };

  const validateBulkInvalidCompany = (callback) => {
    request(app)
      .post('/api/companies')
      .set('X-Validation', 'true')
      .send({
        items: [invalidCompany],
      })
      .expect(400)
      .end((err, res) => {
        should.not.exist(err);
        res.body.should.have.property('name', 'Only alphabets number spaces allowed');
        res.body.should.have.property('index', 0);
        callback(err);
      });
  };

  const createPerson = (callback) => {
    async.mapSeries(
      [
        {
          name: 'sideroad',
          company: 'side',
          age: 32,
        },
        {
          name: 'roadside',
          company: 'road',
          age: 30.0000005,
        },
        {
          name: 'foobar',
          company: 'road',
          age: 40,
        },
      ],
      (data, mapCallback) => {
        request(app)
          .post('/api/people')
          .type('json')
          .send(data)
          .expect(201)
          .end((err) => {
            should.not.exist(err);
            mapCallback(err);
          });
      },
      (err) => {
        should.not.exist(err);
        callback();
      },
    );
  };

  const createPersonWithInvalidCompany = (callback) => {
    async.mapSeries(
      [
        {
          name: 'sideroad',
          company: 'notexist',
          age: 32,
        },
      ],
      (data, mapCallback) => {
        request(app)
          .post('/api/people')
          .type('json')
          .send(data)
          .expect(400)
          .end((err, res) => {
            should.not.exist(err);
            res.body.should.have.property(
              'company',
              'Specified ID (notexist) does not exists in company',
            );
            mapCallback(err);
          });
      },
      (err) => {
        should.not.exist(err);
        callback();
      },
    );
  };

  const duplicatedPerson = (callback) => {
    async.mapSeries(
      [
        {
          name: 'duplicator',
          company: 'side',
          age: 32,
          index: 1,
        },
        {
          name: 'duplicator',
          company: 'side',
          age: 32,
          index: 2,
        },
      ],
      (data, mapCallback) => {
        request(app)
          .post('/api/people')
          .type('json')
          .send(data)
          .expect(data.index === 1 ? 201 : 409)
          .end((err) => {
            should.not.exist(err);
            mapCallback(err);
          });
      },
      (err) => {
        should.not.exist(err);
        request(app)
          .get('/api/people')
          .expect(200)
          .end((_err, res) => {
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/people?offset=0&limit=25');
            res.body.should.have.property('last', '/api/people?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.should.have.property('length', 1);
            res.body.items[0].should.have.property('name', 'duplicator');
            res.body.items[0].company.should.have.property('href', '/api/companies/side');
            res.body.items[0].company.should.have.property('id', 'side');
            callback();
          });
      },
    );
  };

  const createPeriod = (callback) => {
    async.mapSeries(
      [
        {
          name: 'New Year',
          start: '2016-01-01',
          end: '2016-01-03',
        },
        {
          name: 'Coming of Age Day',
          start: '2016-01-11',
          end: '2016-01-11',
        },
        {
          name: 'Golden Week',
          start: '2016-04-29',
          end: '2016-05-05',
        },
      ],
      (data, mapCallback) => {
        request(app)
          .post('/api/holidays')
          .type('json')
          .send(data)
          .expect(201)
          .end((err) => {
            should.not.exist(err);
            mapCallback(err);
          });
      },
      (err) => {
        should.not.exist(err);
        callback();
      },
    );
  };

  beforeEach((done) => {
    cleanup(done);
  });

  it('should return each fields', (done) => {
    creator
      .fields('company')
      .should.equal('id name members president location isStockListing createdAt updatedAt -_id');
    creator.fields('person').should.equal('id name company age createdAt updatedAt -_id');
    done();
  });

  it('should return sort object for mongoose', (done) => {
    creator.parseOrder('company').should.deepEqual({
      company: 1,
    });
    creator.parseOrder('+company').should.deepEqual({
      company: 1,
    });
    creator.parseOrder('+company,-person').should.deepEqual({
      company: 1,
      person: -1,
    });
    done();
  });

  describe('href control', () => {
    it('should create href', (done) => {
      createCompany(() => {
        createPerson(() => {
          creator.makeRelation(
            schemas.company,
            'companies',
            [
              {
                id: 'side',
                name: 'Side',
                president: 'sideroad',
              },
            ],
            [],
            (collection) => {
              collection[0].president.should.have.property('href', '/api/people/sideroad');
              collection[0].president.should.have.property('id', 'sideroad');
              done();
            },
          );
        });
      });
    });

    it('should expand instance', (done) => {
      createCompany(() => {
        createPerson(() => {
          creator.makeRelation(
            schemas.company,
            'companies',
            [
              {
                id: 'side',
                name: 'Side',
                president: 'sideroad',
              },
            ],
            ['president'],
            (collection) => {
              collection[0].president.should.have.property('name', 'sideroad');
              collection[0].president.should.have.property('id', 'sideroad');
              done();
            },
          );
        });
      });
    });

    it('should expand parent', (done) => {
      createCompany(() => {
        createPerson(() => {
          creator.makeRelation(
            schemas.person,
            'people',
            [
              {
                name: 'sideroad',
                company: 'side',
                age: 32,
              },
            ],
            ['company'],
            (collection) => {
              collection[0].company.should.have.property('name', 'Side');
              collection[0].company.should.have.property('id', 'side');
              done();
            },
          );
        });
      });
    });
  });

  describe('create delete collection routing', () => {
    it('should create delete collection', (done) => {
      cleanup(done);
    });

    it('should delete collection by parameter', (done) => {
      createCompany(() => {
        createPerson(() => {
          cleanupWithParameter(() => {
            async.waterfall(
              [
                (callback) => {
                  request(app)
                    .get('/api/companies')
                    .expect(200)
                    .end((err, res) => {
                      should.not.exist(err);
                      res.body.should.have.property('offset', 0);
                      res.body.should.have.property('limit', 25);
                      res.body.should.have.property('first', '/api/companies?offset=0&limit=25');
                      res.body.should.have.property('last', '/api/companies?offset=0&limit=25');
                      res.body.should.have.property('next', null);
                      res.body.should.have.property('prev', null);
                      res.body.items.should.have.property('length', 1);
                      res.body.items[0].should.have.property('name', 'Road');
                      callback();
                    });
                },
                (callback) => {
                  request(app)
                    .get('/api/people')
                    .expect(200)
                    .end((err, res) => {
                      should.not.exist(err);
                      res.body.should.have.property('offset', 0);
                      res.body.should.have.property('limit', 25);
                      res.body.should.have.property('first', '/api/people?offset=0&limit=25');
                      res.body.should.have.property('last', '/api/people?offset=0&limit=25');
                      res.body.should.have.property('next', null);
                      res.body.should.have.property('prev', null);
                      res.body.items.should.have.property('length', 1);
                      res.body.items[0].should.have.property('name', 'foobar');
                      res.body.items[0].company.should.have.property('href', '/api/companies/road');
                      res.body.items[0].company.should.have.property('id', 'road');
                      callback();
                    });
                },
              ],
              () => {
                done();
              },
            );
          });
        });
      });
    });
  });

  describe('create post instance or collection routing', () => {
    it('should create instance', (done) => {
      createCompany(() => {
        createInvalidCompany(done);
      });
    });

    it('should create collection', (done) => {
      createBulkCompany(() => {
        createBulkInvalidCompany(done);
      });
    });

    it('should NOT create instance when instance data does not exists', (done) => {
      createCompany(() => {
        createPerson(() => {
          createCompanyWithIvalidPresident(done);
        });
      });
    });

    it('should NOT create instance when parent data does not exists', (done) => {
      createCompany(() => {
        createPersonWithInvalidCompany(done);
      });
    });

    it('should NOT create instance when duplicated data have post', (done) => {
      createCompany(() => {
        duplicatedPerson(done);
      });
    });
  });

  describe('create validate routing', () => {
    it('should validate instance', (done) => {
      validateCompany(() => {
        validateInvalidCompany(done);
      });
    });

    it('should validate bulk collection', (done) => {
      validateBulkCompany(() => {
        validateBulkInvalidCompany(done);
      });
    });
  });

  it('should create get collection routing', (done) => {
    async.waterfall(
      [
        (callback) => {
          request(app)
            .get('/api/companies')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', null);
              res.body.should.have.property('last', null);
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.should.have.property('length', 0);
              callback();
            });
        },
        (callback) => {
          createCompany(callback);
        },
        (callback) => {
          request(app)
            .get('/api/companies')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/companies?offset=0&limit=25');
              res.body.should.have.property('last', '/api/companies?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(2);
              res.body.items[0].should.have.property('id', 'side');
              res.body.items[0].should.have.property('name', 'Side');
              res.body.items[0].should.have.property('isStockListing', true);
              res.body.items[0].should.have.property('createdAt');
              res.body.items[0].should.have.property('updatedAt');
              res.body.items[0].president.should.have.property('href', null);
              res.body.items[0].members.should.have.property('href', '/api/companies/side/members');
              res.body.items[1].should.have.property('id', 'road');
              res.body.items[1].should.have.property('name', 'Road');
              res.body.items[1].should.have.property('isStockListing', false);
              res.body.items[1].should.have.property('createdAt');
              res.body.items[1].should.have.property('updatedAt');
              res.body.items[1].president.should.have.property('href', null);
              res.body.items[1].members.should.have.property('href', '/api/companies/road/members');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/companies?name=')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/companies?offset=0&limit=25');
              res.body.should.have.property('last', '/api/companies?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(2);
              res.body.items[0].should.have.property('id', 'side');
              res.body.items[0].should.have.property('name', 'Side');
              res.body.items[0].should.have.property('createdAt');
              res.body.items[0].should.have.property('updatedAt');
              res.body.items[0].president.should.have.property('href', null);
              res.body.items[0].members.should.have.property('href', '/api/companies/side/members');
              res.body.items[1].should.have.property('id', 'road');
              res.body.items[1].should.have.property('name', 'Road');
              res.body.items[1].should.have.property('createdAt');
              res.body.items[1].should.have.property('updatedAt');
              res.body.items[1].president.should.have.property('href', null);
              res.body.items[1].members.should.have.property('href', '/api/companies/road/members');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/companies?name=Side')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/companies?offset=0&limit=25');
              res.body.should.have.property('last', '/api/companies?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(1);
              res.body.items[0].should.have.property('id', 'side');
              res.body.items[0].should.have.property('name', 'Side');
              res.body.items[0].should.have.property('createdAt');
              res.body.items[0].should.have.property('updatedAt');
              res.body.items[0].president.should.have.property('href', null);
              res.body.items[0].members.should.have.property('href', '/api/companies/side/members');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/companies?name=S*e')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/companies?offset=0&limit=25');
              res.body.should.have.property('last', '/api/companies?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(1);
              res.body.items[0].should.have.property('id', 'side');
              res.body.items[0].should.have.property('name', 'Side');
              res.body.items[0].should.have.property('createdAt');
              res.body.items[0].should.have.property('updatedAt');
              res.body.items[0].president.should.have.property('href', null);
              res.body.items[0].members.should.have.property('href', '/api/companies/side/members');
              callback();
            });
        },
        (callback) => {
          createPerson(callback);
        },
        (callback) => {
          request(app)
            .get('/api/people')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/people?offset=0&limit=25');
              res.body.should.have.property('last', '/api/people?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(3);
              res.body.items[0].should.have.property('id', 'sideroad');
              res.body.items[0].should.have.property('name', 'sideroad');
              res.body.items[0].should.have.property('age', 32);
              res.body.items[0].should.have.property('createdAt');
              res.body.items[0].should.have.property('updatedAt');
              res.body.items[0].company.should.have.property('href', '/api/companies/side');
              res.body.items[0].company.should.have.property('id', 'side');
              res.body.items[1].should.have.property('id', 'roadside');
              res.body.items[1].should.have.property('name', 'roadside');
              res.body.items[1].should.have.property('age', 30.0000005);
              res.body.items[1].should.have.property('createdAt');
              res.body.items[1].should.have.property('updatedAt');
              res.body.items[1].company.should.have.property('href', '/api/companies/road');
              res.body.items[1].company.should.have.property('id', 'road');
              res.body.items[2].should.have.property('id', 'foobar');
              res.body.items[2].should.have.property('name', 'foobar');
              res.body.items[2].should.have.property('age', 40);
              res.body.items[2].should.have.property('createdAt');
              res.body.items[2].should.have.property('updatedAt');
              res.body.items[2].company.should.have.property('href', '/api/companies/road');
              res.body.items[2].company.should.have.property('id', 'road');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/people?age=[1,30]')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', null);
              res.body.should.have.property('last', null);
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(0);
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/people?age=[31,32]')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/people?offset=0&limit=25');
              res.body.should.have.property('last', '/api/people?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(1);
              res.body.items[0].should.have.property('id', 'sideroad');
              res.body.items[0].should.have.property('name', 'sideroad');
              res.body.items[0].should.have.property('age', 32);
              res.body.items[0].should.have.property('createdAt');
              res.body.items[0].should.have.property('updatedAt');
              res.body.items[0].company.should.have.property('href', '/api/companies/side');
              res.body.items[0].company.should.have.property('id', 'side');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/people?age=[30,31]')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/people?offset=0&limit=25');
              res.body.should.have.property('last', '/api/people?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(1);
              res.body.items[0].should.have.property('id', 'roadside');
              res.body.items[0].should.have.property('name', 'roadside');
              res.body.items[0].should.have.property('age', 30.0000005);
              res.body.items[0].should.have.property('createdAt');
              res.body.items[0].should.have.property('updatedAt');
              res.body.items[0].company.should.have.property('href', '/api/companies/road');
              res.body.items[0].company.should.have.property('id', 'road');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/people?name=sideroad,roadside')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/people?offset=0&limit=25');
              res.body.should.have.property('last', '/api/people?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(2);
              res.body.items[0].should.have.property('id', 'sideroad');
              res.body.items[0].should.have.property('name', 'sideroad');
              res.body.items[0].should.have.property('age', 32);
              res.body.items[0].should.have.property('createdAt');
              res.body.items[0].should.have.property('updatedAt');
              res.body.items[0].company.should.have.property('href', '/api/companies/side');
              res.body.items[0].company.should.have.property('id', 'side');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/people?id=sideroad,roadside')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/people?offset=0&limit=25');
              res.body.should.have.property('last', '/api/people?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(2);
              res.body.items[0].should.have.property('id', 'roadside');
              res.body.items[0].should.have.property('name', 'roadside');
              res.body.items[0].should.have.property('age', 30.0000005);
              res.body.items[0].should.have.property('createdAt');
              res.body.items[0].should.have.property('updatedAt');
              res.body.items[0].company.should.have.property('href', '/api/companies/road');
              res.body.items[0].company.should.have.property('id', 'road');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/people?fields=id,name')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/people?offset=0&limit=25');
              res.body.should.have.property('last', '/api/people?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(3);
              res.body.items[0].should.have.property('id', 'sideroad');
              res.body.items[0].should.have.property('name', 'sideroad');
              res.body.items[0].should.not.have.property('age');
              res.body.items[0].should.not.have.property('createdAt');
              res.body.items[0].should.not.have.property('updatedAt');
              res.body.items[0].should.not.have.property('company');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/people?orderBy=%2Bage')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/people?offset=0&limit=25');
              res.body.should.have.property('last', '/api/people?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(3);
              res.body.items[0].should.have.property('id', 'roadside');
              res.body.items[0].should.have.property('name', 'roadside');
              res.body.items[2].should.have.property('id', 'foobar');
              res.body.items[2].should.have.property('name', 'foobar');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/people?q=foo')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/people?offset=0&limit=25');
              res.body.should.have.property('last', '/api/people?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(1);
              res.body.items[0].should.have.property('id', 'foobar');
              res.body.items[0].should.have.property('name', 'foobar');
              res.body.items[0].should.have.property('age', 40);
              res.body.items[0].should.have.property('createdAt');
              res.body.items[0].should.have.property('updatedAt');
              res.body.items[0].company.should.have.property('href', '/api/companies/road');
              res.body.items[0].company.should.have.property('id', 'road');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/people?q=road')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/people?offset=0&limit=25');
              res.body.should.have.property('last', '/api/people?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(3);

              res.body.items[0].should.have.property('id', 'sideroad');
              res.body.items[0].should.have.property('name', 'sideroad');
              res.body.items[0].should.have.property('age', 32);
              res.body.items[0].should.have.property('createdAt');
              res.body.items[0].should.have.property('updatedAt');
              res.body.items[0].company.should.have.property('href', '/api/companies/side');
              res.body.items[0].company.should.have.property('id', 'side');

              res.body.items[1].should.have.property('id', 'roadside');
              res.body.items[1].should.have.property('name', 'roadside');
              res.body.items[1].should.have.property('age', 30.0000005);
              res.body.items[1].should.have.property('createdAt');
              res.body.items[1].should.have.property('updatedAt');
              res.body.items[1].company.should.have.property('href', '/api/companies/road');
              res.body.items[1].company.should.have.property('id', 'road');

              res.body.items[2].should.have.property('id', 'foobar');
              res.body.items[2].should.have.property('name', 'foobar');
              res.body.items[2].should.have.property('age', 40);
              res.body.items[2].should.have.property('createdAt');
              res.body.items[2].should.have.property('updatedAt');
              res.body.items[2].company.should.have.property('href', '/api/companies/road');
              res.body.items[2].company.should.have.property('id', 'road');
              callback();
            });
        },
        (callback) => {
          createPeriod(callback);
        },
        (callback) => {
          request(app)
            .get('/api/holidays')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/holidays?offset=0&limit=25');
              res.body.should.have.property('last', '/api/holidays?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(3);
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/holidays?start=[2016-01-01,2016-02-01]')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/holidays?offset=0&limit=25');
              res.body.should.have.property('last', '/api/holidays?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(2);
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/holidays?start=[2016-01-01,2016-01-01]')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/api/holidays?offset=0&limit=25');
              res.body.should.have.property('last', '/api/holidays?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(1);
              callback();
            });
        },
      ],
      (err) => {
        done(err);
      },
    );
  });

  it('should create get collection routing', (done) => {
    async.waterfall(
      [
        (callback) => {
          request(app)
            .get('/api/companies')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', null);
              res.body.should.have.property('last', null);
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.should.have.property('length', 0);
              callback();
            });
        },
        (callback) => {
          createCompany(callback);
        },
        (callback) => {
          request(app)
            .get('/api/companies')
            .set('x-json-schema', 'true')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('properties');
              res.body.properties.should.have.property('name');
              res.body.properties.name.should.have.property('pattern', '^[a-zA-Z 0-9]+$');
              res.body.properties.name.should.have.property('type', 'string');
              res.body.properties.members.should.have.property('type', 'children');
              res.body.properties.members.should.have.property('rel', 'person');
              res.body.properties.members.should.have.property('href', '/api/people');
              res.body.properties.president.should.have.property('type', 'instance');
              res.body.properties.president.should.have.property('rel', 'person');
              res.body.properties.president.should.have.property('href', '/api/people');
              res.body.properties.isStockListing.should.have.property('type', 'boolean');
              res.body.required.length.should.equal(1);
              res.body.required[0].should.equal('name');
              callback();
            });
        },
      ],
      (err) => {
        done(err);
      },
    );
  });

  it('should create get instance routing', (done) => {
    async.waterfall(
      [
        (callback) => {
          request(app)
            .get('/api/companies/side')
            .expect(404)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('id', 'Specified ID (side) does not exists in company');
              callback();
            });
        },
        (callback) => {
          createCompany(callback);
        },
        (callback) => {
          request(app)
            .get('/api/companies/side')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('id', 'side');
              res.body.should.have.property('name', 'Side');
              res.body.should.have.property('isStockListing', true);
              res.body.should.have.property('createdAt');
              res.body.should.have.property('updatedAt');
              res.body.president.should.have.property('href', null);
              res.body.members.should.have.property('href', '/api/companies/side/members');

              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/companies/side?fields=id,name')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('id', 'side');
              res.body.should.have.property('name', 'Side');
              res.body.should.not.have.property('isStockListing');
              res.body.should.not.have.property('createdAt');
              res.body.should.not.have.property('updatedAt');
              res.body.should.not.have.property('president');
              res.body.should.not.have.property('members');

              callback();
            });
        },
      ],
      (err) => {
        done(err);
      },
    );
  });

  it('should create get child collection routing', (done) => {
    async.waterfall(
      [
        (callback) => {
          request(app)
            .get('/api/companies/side/members')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', null);
              res.body.should.have.property('last', null);
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.should.have.property('length', 0);
              callback();
            });
        },
        (callback) => {
          createCompany(callback);
        },
        (callback) => {
          createPerson(callback);
        },
        (callback) => {
          request(app)
            .get('/api/companies/side/members')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property(
                'first',
                '/api/companies/side/members?offset=0&limit=25',
              );
              res.body.should.have.property(
                'last',
                '/api/companies/side/members?offset=0&limit=25',
              );
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(1);
              res.body.items[0].should.have.property('id', 'sideroad');
              res.body.items[0].should.have.property('name', 'sideroad');
              res.body.items[0].company.should.have.property('href', '/api/companies/side');
              res.body.items[0].company.should.have.property('id', 'side');
              res.body.items[0].should.have.property('createdAt');
              res.body.items[0].should.have.property('updatedAt');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/companies/side/members?fields=id,name')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property(
                'first',
                '/api/companies/side/members?offset=0&limit=25',
              );
              res.body.should.have.property(
                'last',
                '/api/companies/side/members?offset=0&limit=25',
              );
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(1);
              res.body.items[0].should.have.property('id', 'sideroad');
              res.body.items[0].should.have.property('name', 'sideroad');
              res.body.items[0].should.not.have.property('company');
              res.body.items[0].should.not.have.property('createdAt');
              res.body.items[0].should.not.have.property('updatedAt');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/companies/road/members?orderBy=-age')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property(
                'first',
                '/api/companies/road/members?offset=0&limit=25',
              );
              res.body.should.have.property(
                'last',
                '/api/companies/road/members?offset=0&limit=25',
              );
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.length.should.equal(2);
              res.body.items[0].should.have.property('id', 'foobar');
              res.body.items[0].should.have.property('name', 'foobar');
              res.body.items[1].should.have.property('id', 'roadside');
              res.body.items[1].should.have.property('name', 'roadside');
              callback();
            });
        },
      ],
      (err) => {
        done(err);
      },
    );
  });

  it('should create delete instance routing', (done) => {
    async.waterfall(
      [
        (callback) => {
          createCompany(callback);
        },
        (callback) => {
          request(app)
            .delete('/api/companies/side')
            .expect(200)
            .end((err) => {
              should.not.exist(err);
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/companies/side')
            .expect(404)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('id', 'Specified ID (side) does not exists in company');
              callback();
            });
        },
      ],
      (err) => {
        done(err);
      },
    );
  });

  it('should create post or patch as update instance routing', (done) => {
    async.waterfall(
      [
        (callback) => {
          createCompany(callback);
        },
        (callback) => {
          request(app)
            .get('/api/companies/side')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('id', 'side');
              res.body.should.have.property('name', 'Side');
              res.body.should.have.property('createdAt');
              res.body.should.have.property('updatedAt');
              res.body.president.should.have.property('href', null);
              res.body.members.should.have.property('href', '/api/companies/side/members');
              callback();
            });
        },
        (callback) => {
          createPerson(callback);
        },
        (callback) => {
          request(app)
            .post('/api/companies/side')
            .type('json')
            .send({ president: 'sideroad' })
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.not.have.property('msg');
              callback();
            });
        },
        (callback) => {
          request(app)
            .patch('/api/companies/side')
            .type('json')
            .send({ location: 'Vienna' })
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.not.have.property('msg');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/companies/side')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('id', 'side');
              res.body.should.have.property('name', 'Side');
              res.body.should.have.property('location', 'Vienna');
              res.body.should.have.property('createdAt');
              res.body.should.have.property('updatedAt');
              res.body.president.should.have.property('href', '/api/people/sideroad');
              res.body.president.should.have.property('id', 'sideroad');
              res.body.members.should.have.property('href', '/api/companies/side/members');
              callback();
            });
        },
        (callback) => {
          request(app)
            .post('/api/companies/side')
            .type('json')
            .send({ name: 'aaa' })
            .expect(400)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('name', 'uniq key could not be changed');
              callback();
            });
        },
        (callback) => {
          request(app)
            .patch('/api/companies/side')
            .type('json')
            .send({ name: 'aaa' })
            .expect(400)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('name', 'uniq key could not be changed');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/companies/side')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('id', 'side');
              res.body.should.have.property('name', 'Side');
              res.body.should.have.property('createdAt');
              res.body.should.have.property('updatedAt');
              res.body.president.should.have.property('href', '/api/people/sideroad');
              res.body.president.should.have.property('id', 'sideroad');
              res.body.members.should.have.property('href', '/api/companies/side/members');
              callback();
            });
        },
        (callback) => {
          request(app)
            .post('/api/companies/side')
            .type('json')
            .send({ president: 'notexist' })
            .expect(400)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property(
                'president',
                'Specified ID (notexist) does not exists in person',
              );
              callback();
            });
        },
        (callback) => {
          request(app)
            .patch('/api/companies/side')
            .type('json')
            .send({ president: 'notexist' })
            .expect(400)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property(
                'president',
                'Specified ID (notexist) does not exists in person',
              );
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/companies/side')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('id', 'side');
              res.body.should.have.property('name', 'Side');
              res.body.should.have.property('createdAt');
              res.body.should.have.property('updatedAt');
              res.body.president.should.have.property('href', '/api/people/sideroad');
              res.body.president.should.have.property('id', 'sideroad');
              res.body.members.should.have.property('href', '/api/companies/side/members');
              callback();
            });
        },
        (callback) => {
          request(app)
            .post('/api/companies/side')
            .type('json')
            .send({ location: '12345' })
            .expect(400)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('location', 'Only alphabets allowed');
              callback();
            });
        },
        (callback) => {
          request(app)
            .patch('/api/companies/side')
            .type('json')
            .send({ location: '12345' })
            .expect(400)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('location', 'Only alphabets allowed');
              callback();
            });
        },
        (callback) => {
          request(app)
            .get('/api/companies/side')
            .expect(200)
            .end((err, res) => {
              should.not.exist(err);
              res.body.should.have.property('id', 'side');
              res.body.should.have.property('name', 'Side');
              res.body.should.have.property('createdAt');
              res.body.should.have.property('updatedAt');
              res.body.president.should.have.property('href', '/api/people/sideroad');
              res.body.president.should.have.property('id', 'sideroad');
              res.body.members.should.have.property('href', '/api/companies/side/members');
              callback();
            });
        },
      ],
      (err) => {
        done(err);
      },
    );
  });

  it('should create api doc', (done) => {
    const dest = path.join(__dirname, '../doc');

    creator.createDoc({
      name: 'RESTful API',
      version: '1.0.0',
      description: 'apidoc example project',
      title: 'Custom apiDoc browser title',
      url: 'https://express-restful-api-sample.herokuapp.com',
      sampleUrl: 'https://express-restful-api-sample.herokuapp.com',
      template: {
        withCompare: false,
        withGenerator: true,
      },
      dest,
    });

    const comments = fs.readFileSync(path.join(dest, 'apicomment.js'));
    should.exist(comments);
    done();
  });
});
