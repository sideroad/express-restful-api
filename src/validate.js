var _ = require('lodash');

module.exports = function(config, params, isPartialMatch){
  var errors = {};

  _.map( isPartialMatch ? params : config, function(value, key){
    var regexp = config[key].regexp || '',
        invalid = config[key].invalid,
        value = params[key];

    if( (config[key].required && value === undefined) ||
        (config[key].uniq     && value === undefined) ||
        (config[key].required && value === '') ||
        (config[key].uniq     && value === '') ||
        (config[key].required && value === null) ||
        (config[key].uniq     && value === null) ||
        (regexp && regexp instanceof RegExp   && !regexp.test(value))   ||
        (regexp && typeof regexp === 'string' && !new RegExp(regexp).test(value)) ) {
      errors[key] = invalid || 'Invalid value['+value+']';
    }
  });

  return _(errors).isEmpty() ? {
                                 ok: true
                               }
                             : errors;
};
