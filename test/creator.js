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
    mongoose = require('mongoose'),
    scheme = {
      company: {
        name: {
          uniq: true,
          regexp: /^[a-zA-Z 0-9]+$/,
          invalid: "Only alphabets number spaces allowed"
        },
        members: {
          children: 'person'
        },
        president: {
          instance: 'person'
        }
      },
      person: {
        name: {
          uniq: true,
          text: true
        },
        company: {
          parent: 'company.members',
          text: true
        },
        age: {
          type: 'number'
        }
      }
    },
    req,
    client,
    cors = true;

describe('Creator', function () {

  before(function(){
    mongoose.connect(process.env.MONGO_URL);
    creator = new Creator(mongoose, router, cors);
    app.use(bodyParser.json());
    app.use(router);

    creator.model('company', scheme.company);
    creator.getInstance('company', scheme.company);
    creator.getCollection('company', scheme.company);
    creator.getChildren('company', { children: 'person' }, 'members', scheme.person);
    creator.postInstance('company', scheme.company);
    creator.deleteCollection('company', scheme.company);
    creator.validate('company', scheme.company);

    creator.model('person', scheme.person);
    creator.getInstance('person', scheme.person);
    creator.getCollection('person', scheme.person);
    creator.postInstance('person', scheme.person);
    creator.deleteCollection('person', scheme.person);
    creator.validate('person', scheme.person);

  });

  var cleanup = function(callback){
    request(app)
      .delete('/companies')
      .expect(200)
      .end(function(err, res){
        request(app)
          .delete('/people')
          .expect(200)
          .end(function(err, res){
          callback();
        });
      });
  };

  var cleanupWithParameter = function(callback){
    request(app)
      .delete('/companies')
      .send({name: 'Side'})
      .expect(200)
      .end(function(err, res){
        request(app)
          .delete('/people')
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
        .post('/companies')
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
        .post('/companies')
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
        .post('/companies')
        .type('json')
        .send(data)
        .expect(400)
        .end(function(err, res){
          should.not.exist(err);
          res.body.should.have.property('msg', 'Specified ID ( notexist ) does not exists in person');
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
        .get('/validate/companies')
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
      .get('/validate/companies')
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
        .post('/people')
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
        .post('/people')
        .type('json')
        .send(data)
        .expect(400)
        .end(function(err, res){
          should.not.exist(err);
          res.body.should.have.property('msg', 'Specified ID ( notexist ) does not exists in company');
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
        .post('/people')
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
        .get('/people')
        .expect(200)
        .end(function(err, res){
          should.not.exist(err);
          res.body.should.have.property('offset', 0);
          res.body.should.have.property('limit', 25);
          res.body.should.have.property('first', '/people?offset=0&limit=25');
          res.body.should.have.property('last',  '/people?offset=0&limit=25');
          res.body.should.have.property('next', null);
          res.body.should.have.property('prev', null);
          res.body.items.should.have.property('length', 1);
          res.body.items[0].should.have.property('name', 'duplicator');
          res.body.items[0].company.should.have.property('href', '/companies/side');
          callback();
        });
    });
  };

  beforeEach(function(done){
    cleanup(done);
  });

  it('should return each fields', function(done){
    creator.fields('company').should.equal('id name members president createdAt updatedAt -_id');
    creator.fields('person').should.equal('id name company age createdAt updatedAt -_id');
    done();
  });

  it('should create href', function(done){
    var collection = creator.href(scheme.company, 'companies', [
      {
        id: 'side',
        name: 'Side',
        president: 'sideroad'
      }
    ]);

    collection[0].president.should.have.property('href', '/people/sideroad');
    done();
  });

  it('should create delete collection routing', function(done) {
    cleanup(done);
  });

  it('should delete collection by parameter', function(done) {
    createCompany(function(){
      createPerson(function(){
        cleanupWithParameter(function(){
          request(app)
            .get('/companies')
            .expect(200)
            .end(function(err, res){
              should.not.exist(err);
              res.body.should.have.property('offset', 0);
              res.body.should.have.property('limit', 25);
              res.body.should.have.property('first', '/companies?offset=0&limit=25');
              res.body.should.have.property('last',  '/companies?offset=0&limit=25');
              res.body.should.have.property('next', null);
              res.body.should.have.property('prev', null);
              res.body.items.should.have.property('length', 1);
              res.body.items[0].should.have.property('name', 'Road');
              request(app)
                .get('/people')
                .expect(200)
                .end(function(err, res){
                  should.not.exist(err);
                  res.body.should.have.property('offset', 0);
                  res.body.should.have.property('limit', 25);
                  res.body.should.have.property('first', '/people?offset=0&limit=25');
                  res.body.should.have.property('last',  '/people?offset=0&limit=25');
                  res.body.should.have.property('next', null);
                  res.body.should.have.property('prev', null);
                  res.body.items.should.have.property('length', 1);
                  res.body.items[0].should.have.property('name', 'foobar');
                  res.body.items[0].company.should.have.property('href', '/companies/road');
                  done();
                });
            });
        });
      })
    })
  });

  it('should create post instance routing', function(done) {
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

  it('should create validate routing', function(done) {
    validateCompany(function(){
      validateInvalidCompany(done);
    });
  });

  it('should create get collection routing', function(done) {
    async.waterfall([
      function(callback){
        request(app)
          .get('/companies')
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
          .get('/companies')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/companies?offset=0&limit=25');
            res.body.should.have.property('last',  '/companies?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(2);
            res.body.items[0].should.have.property('id', 'side');
            res.body.items[0].should.have.property('name', 'Side');
            res.body.items[0].should.have.property('createdAt');
            res.body.items[0].should.have.property('updatedAt');
            res.body.items[0].president.should.have.property('href', null);
            res.body.items[0].members.should.have.property('href', '/companies/side/members');
            res.body.items[1].should.have.property('id', 'road');
            res.body.items[1].should.have.property('name', 'Road');
            res.body.items[1].should.have.property('createdAt');
            res.body.items[1].should.have.property('updatedAt');
            res.body.items[1].president.should.have.property('href', null);
            res.body.items[1].members.should.have.property('href', '/companies/road/members');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/companies')
          .send({name:'Side'})
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/companies?offset=0&limit=25');
            res.body.should.have.property('last',  '/companies?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(1);
            res.body.items[0].should.have.property('id', 'side');
            res.body.items[0].should.have.property('name', 'Side');
            res.body.items[0].should.have.property('createdAt');
            res.body.items[0].should.have.property('updatedAt');
            res.body.items[0].president.should.have.property('href', null);
            res.body.items[0].members.should.have.property('href', '/companies/side/members');
            callback();
          });
      },
      function(callback){
        createPerson(callback);
      },
      function(callback){
        request(app)
          .get('/people')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/people?offset=0&limit=25');
            res.body.should.have.property('last',  '/people?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(3);
            res.body.items[0].should.have.property('id', 'sideroad');
            res.body.items[0].should.have.property('name', 'sideroad');
            res.body.items[0].should.have.property('age', 32);
            res.body.items[0].should.have.property('createdAt');
            res.body.items[0].should.have.property('updatedAt');
            res.body.items[0].company.should.have.property('href', '/companies/side');
            res.body.items[1].should.have.property('id', 'roadside');
            res.body.items[1].should.have.property('name', 'roadside');
            res.body.items[1].should.have.property('age', null);
            res.body.items[1].should.have.property('createdAt');
            res.body.items[1].should.have.property('updatedAt');
            res.body.items[1].company.should.have.property('href', '/companies/road');
            res.body.items[2].should.have.property('id', 'foobar');
            res.body.items[2].should.have.property('name', 'foobar');
            res.body.items[2].should.have.property('age', null);
            res.body.items[2].should.have.property('createdAt');
            res.body.items[2].should.have.property('updatedAt');
            res.body.items[2].company.should.have.property('href', '/companies/road');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/people?age=[1,31]')
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
          .get('/people?age=[1,32]')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/people?offset=0&limit=25');
            res.body.should.have.property('last',  '/people?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(1);
            res.body.items[0].should.have.property('id', 'sideroad');
            res.body.items[0].should.have.property('name', 'sideroad');
            res.body.items[0].should.have.property('age', 32);
            res.body.items[0].should.have.property('createdAt');
            res.body.items[0].should.have.property('updatedAt');
            res.body.items[0].company.should.have.property('href', '/companies/side');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/people?fields=id,name')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/people?offset=0&limit=25');
            res.body.should.have.property('last',  '/people?offset=0&limit=25');
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
          .get('/people?q=foo')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/people?offset=0&limit=25');
            res.body.should.have.property('last',  '/people?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(1);
            res.body.items[0].should.have.property('id', 'foobar');
            res.body.items[0].should.have.property('name', 'foobar');
            res.body.items[0].should.have.property('age', null);
            res.body.items[0].should.have.property('createdAt');
            res.body.items[0].should.have.property('updatedAt');
            res.body.items[0].company.should.have.property('href', '/companies/road');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/people?q=road')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/people?offset=0&limit=25');
            res.body.should.have.property('last',  '/people?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(3);

            res.body.items[0].should.have.property('id', 'sideroad');
            res.body.items[0].should.have.property('name', 'sideroad');
            res.body.items[0].should.have.property('age', 32);
            res.body.items[0].should.have.property('createdAt');
            res.body.items[0].should.have.property('updatedAt');
            res.body.items[0].company.should.have.property('href', '/companies/side');

            res.body.items[1].should.have.property('id', 'roadside');
            res.body.items[1].should.have.property('name', 'roadside');
            res.body.items[1].should.have.property('age', null);
            res.body.items[1].should.have.property('createdAt');
            res.body.items[1].should.have.property('updatedAt');
            res.body.items[1].company.should.have.property('href', '/companies/road');

            res.body.items[2].should.have.property('id', 'foobar');
            res.body.items[2].should.have.property('name', 'foobar');
            res.body.items[2].should.have.property('age', null);
            res.body.items[2].should.have.property('createdAt');
            res.body.items[2].should.have.property('updatedAt');
            res.body.items[2].company.should.have.property('href', '/companies/road');
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
          .get('/companies/side')
          .expect(404)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('msg', 'company does not exists');
            callback();
          });
      },
      function(callback){
        createCompany(callback);
      },
      function(callback){
        request(app)
          .get('/companies/side')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('id', 'side');
            res.body.should.have.property('name', 'Side');
            res.body.should.have.property('createdAt');
            res.body.should.have.property('updatedAt');
            res.body.president.should.have.property('href', null);
            res.body.members.should.have.property('href', '/companies/side/members');

            done();
          });
      },
      function(callback){
        request(app)
          .get('/companies/side?fields=id,name')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('id', 'side');
            res.body.should.have.property('name', 'Side');
            res.body.should.not.have.property('createdAt');
            res.body.should.not.have.property('updatedAt');
            res.body.should.not.have.property('president');
            res.body.should.not.have.property('members');

            done();
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
          .get('/companies/side/members')
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
          .get('/companies/side/members')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/companies/side/members?offset=0&limit=25');
            res.body.should.have.property('last',  '/companies/side/members?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(1);
            res.body.items[0].should.have.property('id', 'sideroad');
            res.body.items[0].should.have.property('name', 'sideroad');
            res.body.items[0].company.should.have.property('href', '/companies/side');
            res.body.items[0].should.have.property('createdAt');
            res.body.items[0].should.have.property('updatedAt');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/companies/side/members?fields=id,name')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/companies/side/members?offset=0&limit=25');
            res.body.should.have.property('last',  '/companies/side/members?offset=0&limit=25');
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

    creator.deleteInstance('company', scheme.company);

    async.waterfall([
      function(callback){
        createCompany(callback);
      },
      function(callback){
        request(app)
          .delete('/companies/side')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/companies/side')
          .expect(404)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('msg', 'company does not exists');
            callback();
          });
      }
    ], function(err){
      done(err);
    });
  });

  it('should create post update instance routing', function(done) {

    creator.postAsUpdate('company', scheme.company);

    async.waterfall([
      function(callback){
        createCompany(callback);
      },
      function(callback){
        request(app)
          .get('/companies/side')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('id', 'side');
            res.body.should.have.property('name', 'Side');
            res.body.should.have.property('createdAt');
            res.body.should.have.property('updatedAt');
            res.body.president.should.have.property('href', null);
            res.body.members.should.have.property('href', '/companies/side/members');
            callback();
          });
      },
      function(callback){
        createPerson(callback);
      },
      function(callback){
        request(app)
          .post('/companies/side')
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
          .get('/companies/side')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('id', 'side');
            res.body.should.have.property('name', 'Side');
            res.body.should.have.property('createdAt');
            res.body.should.have.property('updatedAt');
            res.body.president.should.have.property('href', '/people/sideroad');
            res.body.members.should.have.property('href', '/companies/side/members');
            done();
          });
      },
      function(callback){
        request(app)
          .post('/companies/side')
          .type('json')
          .send({name: ''})
          .expect(400)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('msg');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/companies/side')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('id', 'side');
            res.body.should.have.property('name', 'Side');
            res.body.should.have.property('createdAt');
            res.body.should.have.property('updatedAt');
            res.body.president.should.have.property('href', '/people/sideroad');
            res.body.members.should.have.property('href', '/companies/side/members');
            done();
          });
      },
      function(callback){
        request(app)
          .post('/companies/side')
          .type('json')
          .send({president: 'notexist'})
          .expect(400)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('msg');
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/companies/side')
          .expect(200)
          .end(function(err, res){
            should.not.exist(err);
            res.body.should.have.property('id', 'side');
            res.body.should.have.property('name', 'Side');
            res.body.should.have.property('createdAt');
            res.body.should.have.property('updatedAt');
            res.body.president.should.have.property('href', '/people/sideroad');
            res.body.members.should.have.property('href', '/companies/side/members');
            done();
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
