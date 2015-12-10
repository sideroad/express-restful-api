var assert = require('assert'),
    should = require('should'),
    express = require('express'),
    router = express.Router(),
    redis = require('redis'),
    _ = require('lodash'),
    Client = require('../src/client'),
    Creator = require('../src/creator'),
    request = require('supertest'),
    bodyParser = require('body-parser'),
    async = require('async'),
    app = express(),
    config = {
      name: {
        uniq: true
      }
    },
    req,
    client;

describe('Creator', function () {

  before(function(){
    client = new Client(process.env.REDIS_URL);
    creator = new Creator(router, client);
    app.use(bodyParser.json());
    app.use(router);
    creator.deleteCollection('group', config);
    creator.postInstance('group', config);
  });

  var cleanup = function(callback){
    request(app)
      .delete('/groups')
      .expect(200)
      .end(function(err, res){
        callback();
      });
  };

  var create = function(callback){
    request(app)
      .post('/groups')
      .send({name: 'UXD'})
      .expect(201)
      .end(function(err, res){
        callback();
      });
  };

  beforeEach(function(done){
    cleanup(done);
  });

  it('should create delete collection routing', function(done) {
    cleanup(done);
  });

  it('should create post instance routing', function(done) {
    create(done);
  });
  
  it('should create get collection routing', function(done) {

    creator.getCollection('group', config);

    async.waterfall([
      function(callback){
        request(app)
          .get('/groups')
          .expect(200)
          .end(function(err, res){
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', null);
            res.body.should.have.property('last',  null);
            res.body.items.should.have.property('length', 0);
            callback();
          });
      },
      function(callback){
        create(callback);
      },
      function(callback){
        request(app)
          .get('/groups')
          .expect(200)
          .end(function(err, res){
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/groups?offset=0&limit=25');
            res.body.should.have.property('last',  '/groups?offset=0&limit=25');
            res.body.items[0].should.have.property('id', 'uxd');
            res.body.items[0].should.have.property('name', 'UXD');
            res.body.items[0].should.have.property('createdAt');
            res.body.items[0].should.have.property('updatedAt');        
            callback();
          });
      }
    ], function(err){
      done(err);
    });
  });
  
  it('should create get instance routing', function(done) {

    creator.getInstance('group', config);

    async.waterfall([
      function(callback){
        request(app)
          .get('/groups/uxd')
          .expect(404)
          .end(function(err, res){
            res.body.should.have.property('msg', 'group does not exists');
            callback();
          });
      },
      function(callback){
        create(callback);
      },
      function(callback){
        request(app)
          .get('/groups/uxd')
          .expect(200)
          .end(function(err, res){
            res.body.should.have.property('id', 'uxd');
            res.body.should.have.property('name', 'UXD');
            res.body.should.have.property('createdAt');
            res.body.should.have.property('updatedAt');        
            done();
          });        
      }
    ], function(err){
      done(err);
    });

  });
  
  it('should create delete instance routing', function(done) {

    creator.deleteInstance('group', config);

    async.waterfall([
      function(callback){
        create(callback);
      },
      function(callback){
        request(app)
          .delete('/groups/uxd')
          .expect(200)
          .end(function(err, res){
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/groups/uxd')
          .expect(404)
          .end(function(err, res){
            res.body.should.have.property('msg', 'group does not exists');
            callback();
          });
      }
    ], function(err){
      done(err);
    });
  });

  it('should create post update instance routing', function(done) {

    creator.postUpdateInstance('group', config);

    async.waterfall([
      function(callback){
        create(callback);
      },
      function(callback){
        request(app)
          .get('/groups/uxd')
          .expect(200)
          .end(function(err, res){
            res.body.should.have.property('id', 'uxd');
            res.body.should.have.property('name', 'UXD');
            res.body.should.have.property('createdAt');
            res.body.should.have.property('updatedAt');        
            callback();
          });
      },
      function(callback){
        request(app)
          .post('/groups/uxd')
          .send({name: 'foo'})
          .expect(200)
          .end(function(err, res){
            callback();
          });
      },
      function(callback){
        request(app)
          .get('/groups/uxd')
          .expect(200)
          .end(function(err, res){
            res.body.should.have.property('id', 'uxd');
            res.body.should.have.property('name', 'foo');
            res.body.should.have.property('createdAt');
            res.body.should.have.property('updatedAt');        
            done();
          });        
      }
    ], function(err){
      done(err);
    });

  });
});