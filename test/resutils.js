var assert = require('assert'),
    should = require('should'),
    resutils = require('../src/resutils');

describe('error', function () {

  it('should send error', function (done) {
    resutils.error({
      status: function(code){
        code.should.equal(500);
        return {
          json: function(results){
            results.should.have.property('msg', 'error');
            return {
              end: function(){
              }
            };
          }
        };
      }
    }, {
      message: 'error'
    });

    resutils.error({
      status: function(code){
        code.should.equal(400);
        return {
          json: function(results){
            results.should.have.property('msg', 'error');
            return {
              end: function(){
              }
            };
          }
        };
      }
    }, {
      code: 400,
      message: 'error'
    });

    done();
  });

  it('should set access control header', function (done) {
    resutils.accessControl({
      set: function(header){
        header.should.deepEqual({
          'Access-Control-Allow-Origin': 'hogehoge.com',
          'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers':'Origin, X-Requested-With, Content-Type, Accept, X-PINGOTHER',
          'Access-Control-Allow-Credentials': true
        });
      }
    }, {
      method: 'POST',
      get: function(){
        return 'hogehoge.com';
      }
    });

    resutils.accessControl({
      set: function(header){
        header.should.deepEqual({
          'Access-Control-Allow-Origin': 'hogehoge.com',
          'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers':'*',
          'Access-Control-Allow-Credentials': true
        });
      }
    }, {
      method: 'GET',
      get: function(){
        return 'hogehoge.com';
      }
    });

    done();
  });
});
