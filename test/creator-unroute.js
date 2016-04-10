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
    creator = new Creator(mongoose, router, cors, '/api');
    app.use(bodyParser.json());
    app.use(router);

    creator.model('company', schema.company);
    creator.getInstance('company', schema.company);
    creator.getCollection('company', schema.company);
    creator.getChildren('company', { type: 'children', relation: 'person' }, 'members', schema.person);
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

  it('should unroute router', function(done){
    creator.unroute();
    async.waterfall([
      function(callback){
        request(app)
          .get('/api/companies')
          .expect(404)
          .end(function(err, res){
            console.log(err);
            should.not.exist(err);
            callback();
          });
      }
    ], function(err){
      done(err);
    });
  });

});
