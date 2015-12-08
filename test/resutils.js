var assert = require('assert'),
    should = require('should'),
    resutils = require('../src/resutils');

describe('error', function () {
  
  it('should send error', function (done) {
    resutils.error({
      send: function(code, results){
        results.should.have.property('msg', 'error');
        code.should.equal(500);
      }
    }, {
      message: 'error'
    });

    resutils.error({
      send: function(code, results){
        results.should.have.property('msg', 'error');
        code.should.equal(400);
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
          'Access-Control-Allow-Headers':'Origin, X-Requested-With, Content-Type, Accept',
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