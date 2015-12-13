var assert = require('assert'),
    should = require('should'),
    express = require('express'),
    router = express.Router(),
    redis = require('redis'),
    _ = require('lodash'),
    Creator = require('../src/creator'),
    request = require('supertest'),
    bodyParser = require('body-parser'),
    async = require('async'),
    app = express(),
    mongoose = require('mongoose'),
    scheme = {
      group: {
        name: {
          uniq: true
        },
        members: {
          children: 'people'
        },
        collaborators: {
          children: 'people'
        },
        owner: {
          instance: 'people'
        }
      },
      people: {
        name: {
          uniq: true
        },
        group: {
          parent: 'group.members'
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
    creator.model('group', scheme.group);
    creator.model('people', scheme.people);
    creator.deleteCollection('group', scheme.group);
    creator.deleteCollection('people', scheme.people);
    creator.postInstance('group', scheme.group);
    creator.postInstance('people', scheme.people);
  });

  var cleanup = function(callback){
    request(app)
      .delete('/groups')
      .expect(200)
      .end(function(err, res){
        request(app)
          .delete('/peoples')
          .expect(200)
          .end(function(err, res){
          callback();
        });
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

  var createChild = function(callback){
    request(app)
      .post('/peoples')
      .send({
        name: 'sideroad',
        group: 'uxd'
      })
      .expect(201)
      .end(function(err, res){
        callback();
      });
  };

  beforeEach(function(done){
    cleanup(done);
  });

  it('should return each fields', function(done){
    creator.fields('group').should.equal('id createdAt updatedAt name members collaborators owner');
    creator.fields('people').should.equal('id createdAt updatedAt name group');
    done();
  });

  it('should create href', function(done){
    var collection = creator.href(scheme.group, 'groups', [
      {
        id: 'uxd',
        name: 'UXD',
        owner: 'sideroad'
      }
    ]);

    collection[0].owner.should.have.property('href', '/peoples/sideroad');
    done();
  });

  it('should create delete collection routing', function(done) {
    cleanup(done);
  });

  it('should create post instance routing', function(done) {
    create(done);
  });
  
  it('should create get collection routing', function(done) {

    creator.getCollection('group', scheme.group);

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
            res.body.items[0].owner.should.have.property('href', null);
            res.body.items[0].members.should.have.property('href', '/groups/uxd/members');
            res.body.items[0].collaborators.should.have.property('href', '/groups/uxd/collaborators');
            callback();
          });
      }
    ], function(err){
      done(err);
    });
  });
  
  it('should create get instance routing', function(done) {

    creator.getInstance('group', scheme.group);

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
            res.body.owner.should.have.property('href', null);
            res.body.members.should.have.property('href', '/groups/uxd/members');
            res.body.collaborators.should.have.property('href', '/groups/uxd/collaborators');

            done();
          });        
      }
    ], function(err){
      done(err);
    });

  });

  it('should create get child collection routing', function(done) {

    creator.getChildren('group', { children: 'people' }, 'members', scheme.people);

    async.waterfall([
      function(callback){
        request(app)
          .get('/groups/uxd/members')
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
        createChild(callback);
      },
      function(callback){
        request(app)
          .get('/groups/uxd/members')
          .expect(200)
          .end(function(err, res){
            res.body.should.have.property('offset', 0);
            res.body.should.have.property('limit', 25);
            res.body.should.have.property('first', '/groups/uxd/members?offset=0&limit=25');
            res.body.should.have.property('last',  '/groups/uxd/members?offset=0&limit=25');
            res.body.items[0].should.have.property('id', 'sideroad');
            res.body.items[0].should.have.property('name', 'sideroad');
            res.body.items[0].group.should.have.property('href', '/groups/uxd');
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

    creator.deleteInstance('group', scheme.group);

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

    creator.postAsUpdate('group', scheme.group);

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
            res.body.owner.should.have.property('href', null);
            res.body.members.should.have.property('href', '/groups/uxd/members');
            res.body.collaborators.should.have.property('href', '/groups/uxd/collaborators');            
            callback();
          });
      },
      function(callback){
        request(app)
          .post('/groups/uxd')
          .send({owner: 'sideroad'})
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
            res.body.should.have.property('name', 'UXD');
            res.body.should.have.property('createdAt');
            res.body.should.have.property('updatedAt');
            res.body.owner.should.have.property('href', '/peoples/sideroad');
            res.body.members.should.have.property('href', '/groups/uxd/members');
            res.body.collaborators.should.have.property('href', '/groups/uxd/collaborators');
            done();
          });        
      }
    ], function(err){
      done(err);
    });

  });
});