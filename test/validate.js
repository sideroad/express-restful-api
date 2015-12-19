var assert = require('assert'),
    should = require('should'),
    validate = require('../src/validate');

describe('validate', function () {

  it('should return msg when invalid data is exists', function (done) {
    var results = {};

    results = validate({
      number: {
        regexp: '^\\d+$'
      }
    }, {
      number: 'a'
    });

    results.should.not.have.property('ok');
    results.should.have.property('msg', 'Invalid value: key[number] value[a]');

    results = validate({
      number: {
        regexp: /^\d+$/
      }
    }, {
      number: 'a'
    });

    results.should.not.have.property('ok');
    results.should.have.property('msg', 'Invalid value: key[number] value[a]');

    results = validate({
      number: {
        required: true
      }
    }, {
      number: null
    });

    results.should.not.have.property('ok');
    results.should.have.property('msg', 'Invalid value: key[number] value[null]');
    done();
  });

  it('should return ok if the data is valid', function (done) {
    var results = {};

    results = validate({
      number: {
        regexp: '^\\d+$'
      }
    }, {
      number: 1
    });

    results.should.have.property('ok', true);
    results.should.not.have.property('msg');

    results = validate({
      number: {
        required: true
      }
    }, {
      number: 1
    });

    results.should.have.property('ok', true);
    results.should.not.have.property('msg');
    done();
  });
});