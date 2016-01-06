var _ = require('lodash');

module.exports = function(config, params){
  var errors = {};

  _.map(params, function(value, key){
    var regexp = config[key].regexp || '',
        invalid = config[key].invalid;

    if( (config[key].required && !value) ||
        (config[key].uniq     && !value) ||
        (regexp && regexp instanceof RegExp   && !regexp.test(value))   ||
        (regexp && typeof regexp === 'string' && !new RegExp(regexp).test(value)) ) {
      errors[key] = invalid || 'Invalid value: key[' + key + '] value['+value+']';
    }
  });

  return _(errors).isEmpty() ? {
                                 ok: true
                               }
                             : errors;
};
