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
          uniq: true
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
          uniq: true
        },
        company: {
          parent: 'company.members'
        },
        age: {
          type: 'number'
        }
      }
    },
    req,
    client;

describe('Creator', function () {

  before(function(){
    mongoose.connect(process.env.MONGO_URL);
    creator = new Creator(mongoose, router);
    app.use(bodyParser.json());
    app.use(router);
    creator.model('company', scheme.company);
    creator.model('person', scheme.person);

    creator.deleteCollection('company', scheme.company);
    creator.postInstance('company', scheme.company);
    creator.getCollection('company', scheme.company);
    creator.getInstance('company', scheme.company);
    creator.getChildren('company', { children: 'person' }, 'members', scheme.person);

    creator.deleteCollection('person', scheme.person);
    creator.postInstance('person', scheme.person);
    creator.getCollection('person', scheme.person);
    creator.getInstance('person', scheme.person);

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

  var createCompany = function(callback){
    request(app)
      .post('/companies')
      .send({name: 'Side'})
      .expect(201)
      .end(function(err, res){
        request(app)
          .post('/companies')
          .send({name: 'Road'})
          .expect(201)
          .end(function(err, res){
            callback();
          }); 
      });
  };

  var createPerson = function(callback){
    request(app)
      .post('/people')
      .send({
        name: 'sideroad',
        company: 'side',
        age: 32
      })
      .expect(201)
      .end(function(err, res){
        request(app)
          .post('/people')
          .send({
            name: 'roadside',
            company: 'road'
          })
          .expect(201)
          .end(function(err, res){
            callback();
          });
      });
  };

  beforeEach(function(done){
    cleanup(done);
  });

  it('should return each fields', function(done){
    creator.fields('company').should.equal('name members president id createdAt updatedAt');
    creator.fields('person').should.equal('name company age id createdAt updatedAt');
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

  it('should create post instance routing', function(done) {
    createCompany(done);
  });
  
  it('should create get collection routing', function(done) {
    async.waterfall([
      function(callback){
        request(app)
          .get('/companies')
          .expect(200)
          .end(function(err, res){
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
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/people?offset=0&limit=25');
            res.body.should.have.property('last',  '/people?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items.length.should.equal(2);
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
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/people')
          .send({age: '[1,31]'})
          .expect(200)
          .end(function(err, res){
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
          .get('/people')
          .send({age: '[1,32]'})
          .expect(200)
          .end(function(err, res){
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
            res.body.should.have.property('id', 'side');
            res.body.should.have.property('name', 'Side');
            res.body.should.have.property('createdAt');
            res.body.should.have.property('updatedAt');
            res.body.president.should.have.property('href', null);
            res.body.members.should.have.property('href', '/companies/side/members');

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
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/companies/side/members?offset=0&limit=25');
            res.body.should.have.property('last',  '/companies/side/members?offset=0&limit=25');
            res.body.should.have.property('next', null);
            res.body.should.have.property('prev', null);
            res.body.items[0].should.have.property('id', 'sideroad');
            res.body.items[0].should.have.property('name', 'sideroad');
            res.body.items[0].company.should.have.property('href', '/companies/side');
            res.body.items[0].should.have.property('createdAt');
            res.body.items[0].should.have.property('updatedAt');
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
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/companies/side')
          .expect(404)
          .end(function(err, res){
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
        request(app)
          .post('/companies/side')
          .send({president: 'sideroad'})
          .expect(200)
          .end(function(err, res){
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/companies/side')
          .expect(200)
          .end(function(err, res){
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