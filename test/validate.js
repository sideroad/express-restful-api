var assert = require('assert'),
    should = require('should'),
    validate = require('../src/validate');

describe('validate', function () {

  it('should return message when invalid data is exists', function (done) {
    var results = {};

    results = validate({
      number: {
        regexp: '^\\d+$'
      }
    }, {
      number: 'a'
    });

    results.should.not.have.property('ok');
    results.should.have.property('number', 'Invalid value: key[number] value[a]');

    results = validate({
      number: {
        regexp: /^\d+$/
      }
    }, {
      number: 'a'
    });

    results.should.not.have.property('ok');
    results.should.have.property('number', 'Invalid value: key[number] value[a]');

    results = validate({
      number: {
        required: true
      }
    }, {
      number: null
    });

    results.should.not.have.property('ok');
    results.should.have.property('number', 'Invalid value: key[number] value[null]');
    done();
  });


  it('should return customized message when invalid data is exists', function (done) {
    var results = {};

    results = validate({
      number: {
        regexp: '^\\d+$',
        invalid: 'Only number allowed'
      }
    }, {
      number: 'a'
    });

    results.should.not.have.property('ok');
    results.should.have.property('number', 'Only number allowed');

    results = validate({
      number: {
        regexp: /^\d+$/,
        invalid: 'Only number allowed'
      }
    }, {
      number: 'a'
    });

    results.should.not.have.property('ok');
    results.should.have.property('number', 'Only number allowed');

    results = validate({
      number: {
        required: true,
        invalid: 'Number is required'
      }
    }, {
      number: null
    });

    results.should.not.have.property('ok');
    results.should.have.property('number', 'Number is required');
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
    results.should.not.have.property('number');

    results = validate({
      number: {
        required: true
      }
    }, {
      number: 1
    });

    results.should.have.property('ok', true);
    results.should.not.have.property('number');
    done();
  });
});
