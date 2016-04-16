var assert = require('assert'),
    should = require('should'),
    express = require('express'),
    router = express.Router(),
    redis = require('redis'),
    _ = require('lodash'),
    fs = require('fs'),
    Creator = require('../src/creator'),
    request = require('supertest'),
    bodyParser = require('body-parser'),
    async = require('async'),
    app = express(),
    prefix = '/api',
    mongoose = require('mongoose'),
    schema = {
      company: {
        name: {
          uniq: true,
          regexp: /^[a-zA-Z 0-9]+$/,
          invalid: "Only alphabets number spaces allowed"
        },
        members: {
          type: 'children',
          relation: 'person'
        },
        president: {
          type: 'instance',
          relation: 'person'
        },
        location: {
          type: 'string',
          regexp: /^[a-zA-Z]+$/,
          invalid: "Only alphabets allowed"
        }
      },
      person: {
        name: {
          uniq: true,
          text: true
        },
        company: {
          type: 'parent',
          relation: 'company.members',
          text: true
        },
        age: {
          type: 'number'
        }
      },
      holiday: {
        name: {
          uniq: true,
          text: true
        },
        start: {
          type: 'date'
        },
        end: {
          type: 'date'
        }
      }
    },
    req,
    client,
    cors = true;

describe('Creator', function () {

  before(function(){
    mongoose.connect(process.env.MONGO_URL);
    mongoose.models = {};
    mongoose.modelSchemas = {};

    creator = new Creator(mongoose, router, cors, prefix);
    app.use(bodyParser.json());
    app.use(router);

    creator.model('company', schema.company);
    creator.getInstance('company', schema.company);
    creator.getCollection('company', schema.company);
    creator.getChildren('company', { type: 'children', relation: 'person' }, 'members', schema.person);
    creator.deleteInstance('company', schema.company);
    creator.postAsUpdate('company', schema.company);
    creator.postInstance('company', schema.company);
    creator.deleteCollection('company', schema.company);
    creator.validate('company', schema.company);

    creator.model('person', schema.person);
    creator.getInstance('person', schema.person);
    creator.getCollection('person', schema.person);
    creator.postInstance('person', schema.person);
    creator.deleteCollection('person', schema.person);
    creator.validate('person', schema.person);

    creator.model('holiday', schema.holiday);
    creator.getInstance('holiday', schema.holiday);
    creator.getCollection('holiday', schema.holiday);
    creator.postInstance('holiday', schema.holiday);
    creator.deleteCollection('holiday', schema.holiday);
    creator.validate('holiday', schema.holiday);

  });

  after(function(){
    mongoose.disconnect();
  });

  var cleanup = function(callback){
    async.mapSeries([
      '/api/companies',
      '/api/people',
      '/api/holidays'
    ], function(uri, callback){
      request(app)
        .delete(uri)
        .expect(200)
        .end(function(err, res){
          callback(err);
        });
    }, function(err){
      should.not.exist(err);
      callback();
    });
  };

  var cleanupWithParameter = function(callback){
    request(app)
      .delete('/api/companies')
      .send({name: 'Side'})
      .expect(200)
      .end(function(err, res){
        request(app)
          .delete('/api/people')
          .send({name: '*side*'})
          .expect(200)
          .end(function(err, res){
          callback();
        });
      });
  };

  var validCompanies = [
    {
      name: 'Side'
    },
    {
      name: 'Road'
    }
  ];

  var invalidCompany = {
    name: 'Invalid_Name'
  };

  var createCompany = function(callback){
    async.mapSeries(validCompanies, function(data, callback){
      request(app)
        .post('/api/companies')
        .type('json')
        .send(data)
        .expect(201)
        .end(function(err, res){
          callback(err);
        });
    }, function(err){
      should.not.exist(err);
      callback();
    });
  };

  var createInvalidCompany = function(callback){
    async.mapSeries([
      invalidCompany,
      {
        name: ''
      },
      {}
    ], function(data, callback){
      request(app)
        .post('/api/companies')
        .type('json')
        .send(data)
        .expect(400)
        .end(function(err, res){
          should.not.exist(err);
          res.body.should.have.property('name', 'Only alphabets number spaces allowed');
          callback(err);
        });
    }, function(err){
      should.not.exist(err);
      callback();
    });
  }

  var createCompanyWithIvalidPresident = function(callback){
    async.mapSeries([
      {
        name: 'sideroad',
        president: 'notexist'
      }
    ], function(data, callback){
      request(app)
        .post('/api/companies')
        .type('json')
        .send(data)
        .expect(400)
        .end(function(err, res){
          should.not.exist(err);
          res.body.should.have.property('president', 'Specified ID ( notexist ) does not exists in person');
          callback(err);
        });
    }, function(err){
      should.not.exist(err);
      callback();
    });
  };

  var validateCompany = function(callback){
    async.mapSeries(validCompanies, function(data, callback){
      request(app)
        .get('/api/validate/companies')
        .send(data)
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          res.body.should.have.property('ok');
          callback(err);
        });
    }, function(err){
      should.not.exist(err);
      callback();
    });
  };

  var validateInvalidCompany = function(callback){
    request(app)
      .get('/api/validate/companies')
      .send(invalidCompany)
      .expect(400)
      .end(function(err, res){
        should.not.exist(err);
        res.body.should.have.property('name', 'Only alphabets number spaces allowed')
        callback(err);
      });
  }

  var createPerson = function(callback){
    async.mapSeries([
      {
        name: 'sideroad',
        company: 'side',
        age: 32
      },{
        name: 'roadside',
        company: 'road'
      },{
        name: 'foobar',
        company: 'road'
      }
    ], function(data, callback){
      request(app)
        .post('/api/people')
        .type('json')
        .send(data)
        .expect(201)
        .end(function(err, res){
          should.not.exist(err);
          callback(err);
        });
    }, function(err){
      should.not.exist(err);
      callback();
    });
  };

  var createPersonWithInvalidCompany = function(callback){
    async.mapSeries([
      {
        name: 'sideroad',
        company: 'notexist',
        age: 32
      }
    ], function(data, callback){
      request(app)
        .post('/api/people')
        .type('json')
        .send(data)
        .expect(400)
        .end(function(err, res){
          should.not.exist(err);
          res.body.should.have.property('company', 'Specified ID ( notexist ) does not exists in company');
          callback(err);
        });
    }, function(err){
      should.not.exist(err);
      callback();
    });
  };

  var duplicatedPerson = function(callback){
    async.mapSeries([
      {
        name: 'duplicator',
        company: 'side',
        age: 32,
        index: 1
      },{
        name: 'duplicator',
        company: 'side',
        age: 32,
        index: 2
      }
    ], function(data, callback){
      request(app)
        .post('/api/people')
        .type('json')
        .send(data)
        .expect( data.index === 1 ? 201 : 409 )
        .end(function(err, res){
          should.not.exist(err);
          callback( err );
        });
    }, function(err){
      should.not.exist(err);
      request(app)
        .get('/api/people')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          res.body.should.have.property('offset', 0);
          res.body.should.have.property('limit', 25);
          res.body.should.have.property('first', '/api/people?offset=0&limit=25');
          res.body.should.have.property('last',  '/api/people?offset=0&limit=25');
          res.body.should.have.property('next', null);
          res.body.should.have.property('prev', null);
          res.body.items.should.have.property('length', 1);
          res.body.items[0].should.have.property('name', 'duplicator');
          res.body.items[0].company.should.have.property('href', '/api/companies/side');
          res.body.items[0].company.should.have.property('id', 'side');
          callback();
        });
    });
  };

  var createPeriod = function(callback){
    async.mapSeries([
      {
        name: 'New Year',
        start: '2016-01-01',
        end: '2016-01-03'
      },{
        name: 'Coming of Age Day',
        start: '2016-01-11',
        end: '2016-01-11'
      },{
        name: 'Golden Week',
        start: '2016-04-29',
        end: '2016-05-05'
      }
    ], function(data, callback){
      request(app)
        .post('/api/holidays')
        .type('json')
        .send(data)
        .expect(201)
        .end(function(err, res){
          should.not.exist(err);
          callback(err);
        });
    }, function(err){
      should.not.exist(err);
      callback();
    });
  };

  beforeEach(function(done){
    cleanup(done);
  });

  it('should return each fields', function(done){
    creator.fields('company').should.equal('id name members president location createdAt updatedAt -_id');
    creator.fields('person').should.equal('id name company age createdAt updatedAt -_id');
    done();
  });

  it('should create href', function(done){
    var collection = creator.href(schema.company, 'companies', [
      {
        id: 'side',
        name: 'Side',
        president: 'sideroad'
      }
    ]);

    collection[0].president.should.have.property('href', '/api/people/sideroad');
    collection[0].president.should.have.property('id', 'sideroad');
    done();
  });

  describe('create delete collection routing', function() {
    it('should create delete collection', function(done) {
      cleanup(done);
    });

    it('should delete collection by parameter', function(done) {
      createCompany(function(){
        createPerson(function(){
          cleanupWithParameter(function(){
            request(app)
              .get('/api/companies')
              .expect(200)
              .end(function(err, res){
                should.not.exist(err);
                res.body.should.have.property('offset', 0);
                res.body.should.have.property('limit', 25);
                res.body.should.have.property('first', '/api/companies?offset=0&limit=25');
                res.body.should.have.property('last',  '/api/companies?offset=0&limit=25');
                res.body.should.have.property('next', null);
                res.body.should.have.property('prev', null);
                res.body.items.should.have.property('length', 1);
                res.body.items[0].should.have.property('name', 'Road');
                request(app)
                  .get('/api/people')
                  .expect(200)
                  .end(function(err, res){
                    should.not.exist(err);
                    res.body.should.have.property('offset', 0);
                    res.body.should.have.property('limit', 25);
                    res.body.should.have.property('first', '/api/people?offset=0&limit=25');
                    res.body.should.have.property('last',  '/api/people?offset=0&limit=25');
                    res.body.should.have.property('next', null);
                    res.body.should.have.property('prev', null);
                    res.body.items.should.have.property('length', 1);
                    res.body.items[0].should.have.property('name', 'foobar');
                    res.body.items[0].company.should.have.property('href', '/api/companies/road');
                    res.body.items[0].company.should.have.property('id', 'road');
                    done();
                  });
              });
          });
        })
      })
    });

  });

  describe('create post instance routing', function(){
    it('should create instance', function(done) {
      createCompany(function(){
        createInvalidCompany(done);
      });
    });

    it('should NOT create instance when instance data does not exists', function(done) {
      createCompany(function(){
        createPerson(function(){
          createCompanyWithIvalidPresident(done);
        });
      });
    });

    it('should NOT create instance when parent data does not exists', function(done) {
      createCompany(function(){
        createPersonWithInvalidCompany(done);
      });
    });

    it('should NOT create instance when duplicated data have post', function(done) {
      createCompany(function(){
        duplicatedPerson(done);
      });
    });

  });

  describe('create validate routing', function(){
    it('should validate', function(done) {
      validateCompany(function(){
        validateInvalidCompany(done);
      });
    });
  });

  it('should create get collection routing', function(done) {
    async.waterfall([
      function(callback){
        request(app)
          .get('/api/companies')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', null);
            res.body.should.have.property('last',  null);
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.should.have.property('length', 0);
            callback();
          });
      },
      function(callback){
        createCompany(callback);
      },
      function(callback){
        request(app)
          .get('/api/companies')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/companies?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/companies?offset=0&limit=25');
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
      function(callback){
        request(app)
          .get('/api/companies?name=')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/companies?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/companies?offset=0&limit=25');
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
      function(callback){
        request(app)
          .get('/api/companies')
          .send({name:'Side'})
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/companies?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/companies?offset=0&limit=25');
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
      function(callback){
        createPerson(callback);
      },
      function(callback){
        request(app)
          .get('/api/people')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/people?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/people?offset=0&limit=25');
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
            res.body.items[1].should.have.property('age', null);
            res.body.items[1].should.have.property('createdAt');
            res.body.items[1].should.have.property('updatedAt');
            res.body.items[1].company.should.have.property('href', '/api/companies/road');
            res.body.items[1].company.should.have.property('id', 'road');
            res.body.items[2].should.have.property('id', 'foobar');
            res.body.items[2].should.have.property('name', 'foobar');
            res.body.items[2].should.have.property('age', null);
            res.body.items[2].should.have.property('createdAt');
            res.body.items[2].should.have.property('updatedAt');
            res.body.items[2].company.should.have.property('href', '/api/companies/road');
            res.body.items[2].company.should.have.property('id', 'road');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/api/people?age=[1,31]')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', null);
            res.body.should.have.property('last',  null);
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(0);
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/api/people?age=[1,32]')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/people?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/people?offset=0&limit=25');
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
      function(callback){
        request(app)
          .get('/api/people?fields=id,name')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/people?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/people?offset=0&limit=25');
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
      function(callback){
        request(app)
          .get('/api/people?q=foo')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/people?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/people?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(1);
            res.body.items[0].should.have.property('id', 'foobar');
            res.body.items[0].should.have.property('name', 'foobar');
            res.body.items[0].should.have.property('age', null);
            res.body.items[0].should.have.property('createdAt');
            res.body.items[0].should.have.property('updatedAt');
            res.body.items[0].company.should.have.property('href', '/api/companies/road');
            res.body.items[0].company.should.have.property('id', 'road');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/api/people?q=road')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/people?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/people?offset=0&limit=25');
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
            res.body.items[1].should.have.property('age', null);
            res.body.items[1].should.have.property('createdAt');
            res.body.items[1].should.have.property('updatedAt');
            res.body.items[1].company.should.have.property('href', '/api/companies/road');
            res.body.items[1].company.should.have.property('id', 'road');

            res.body.items[2].should.have.property('id', 'foobar');
            res.body.items[2].should.have.property('name', 'foobar');
            res.body.items[2].should.have.property('age', null);
            res.body.items[2].should.have.property('createdAt');
            res.body.items[2].should.have.property('updatedAt');
            res.body.items[2].company.should.have.property('href', '/api/companies/road');
            res.body.items[2].company.should.have.property('id', 'road');
            callback();
          });
      },
      function(callback){
        createPeriod(callback);
      },
      function(callback){
        request(app)
          .get('/api/holidays')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/holidays?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/holidays?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(3);
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/api/holidays?start=[2016-01-01,2016-02-01]')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/holidays?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/holidays?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(2);
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/api/holidays?start=[2016-01-01,2016-01-01]')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/holidays?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/holidays?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(1);
            callback();
          });
      },
    ], function(err){
      done(err);
    });
  });

  it('should create get instance routing', function(done) {

    async.waterfall([
      function(callback){
        request(app)
          .get('/api/companies/side')
          .expect(404)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('id', 'Specified ID (side) does not exists in company');
            callback();
          });
      },
      function(callback){
        createCompany(callback);
      },
      function(callback){
        request(app)
          .get('/api/companies/side')
          .expect(200)
          .end(function(err, res){
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
      function(callback){
        request(app)
          .get('/api/companies/side?fields=id,name')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('id', 'side');
            res.body.should.have.property('name', 'Side');
            res.body.should.not.have.property('createdAt');
            res.body.should.not.have.property('updatedAt');
            res.body.should.not.have.property('president');
            res.body.should.not.have.property('members');

            callback();
          });
      }
    ], function(err){
      done(err);
    });

  });

  it('should create get child collection routing', function(done) {


    async.waterfall([
      function(callback){
        request(app)
          .get('/api/companies/side/members')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', null);
            res.body.should.have.property('last',  null);
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.should.have.property('length', 0);
            callback();
          });
      },
      function(callback){
        createCompany(callback);
      },
      function(callback){
        createPerson(callback);
      },
      function(callback){
        request(app)
          .get('/api/companies/side/members')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/companies/side/members?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/companies/side/members?offset=0&limit=25');
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
      function(callback){
        request(app)
          .get('/api/companies/side/members?fields=id,name')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/api/companies/side/members?offset=0&limit=25');
            res.body.should.have.property('last',  '/api/companies/side/members?offset=0&limit=25');
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
      }
    ], function(err){
      done(err);
    });
  });



  it('should create delete instance routing', function(done) {
    async.waterfall([
      function(callback){
        createCompany(callback);
      },
      function(callback){
        request(app)
          .delete('/api/companies/side')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/api/companies/side')
          .expect(404)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('id', 'Specified ID (side) does not exists in company');
            callback();
          });
      }
    ], function(err){
      done(err);
    });
  });

  it('should create post update instance routing', function(done) {

    async.waterfall([
      function(callback){
        createCompany(callback);
      },
      function(callback){
        request(app)
          .get('/api/companies/side')
          .expect(200)
          .end(function(err, res){
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
      function(callback){
        createPerson(callback);
      },
      function(callback){
        request(app)
          .post('/api/companies/side')
          .type('json')
          .send({president: 'sideroad'})
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.not.have.property('msg');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/api/companies/side')
          .expect(200)
          .end(function(err, res){
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
      function(callback){
        request(app)
          .post('/api/companies/side')
          .type('json')
          .send({name: 'aaa'})
          .expect(400)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('name', 'uniq key could not be changed');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/api/companies/side')
          .expect(200)
          .end(function(err, res){
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
      function(callback){
        request(app)
          .post('/api/companies/side')
          .type('json')
          .send({president: 'notexist'})
          .expect(400)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('president', 'Specified ID ( notexist ) does not exists in person');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/api/companies/side')
          .expect(200)
          .end(function(err, res){
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
      function(callback){
        request(app)
          .post('/api/companies/side')
          .type('json')
          .send({location: '12345'})
          .expect(400)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('location', 'Only alphabets allowed');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/api/companies/side')
          .expect(200)
          .end(function(err, res){
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
      }
    ], function(err){
      done(err);
    });

  });

  it('should create api doc', function(done) {
    var path = require('path'),
        dest = path.join( __dirname, '../doc' );

    creator.createDoc({
      "name": "RESTful API",
      "version": "1.0.0",
      "description": "apidoc example project",
      "title": "Custom apiDoc browser title",
      "url" : "https://express-restful-api-sample.herokuapp.com",
      "sampleUrl": "https://express-restful-api-sample.herokuapp.com",
      "template": {
        "withCompare": false,
        "withGenerator": true
      },
      "dest": dest
    });

    var comments = fs.readFileSync(path.join(dest, 'apicomment.js'));
    should.exist(comments);
    done();
  });

});
