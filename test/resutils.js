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
});
