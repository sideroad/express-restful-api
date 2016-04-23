var _ = require('lodash');

module.exports = function(config, params, isPartialMatch){
  var errors = {};

  _.map( isPartialMatch ? params : config, function(value, key){
    var pattern = config[key].pattern || '',
        invalid = config[key].invalid,
        value = params[key];

    if( (config[key].required && value === undefined) ||
        (config[key].uniq     && value === undefined) ||
        (config[key].required && value === '') ||
        (config[key].uniq     && value === '') ||
        (config[key].required && value === null) ||
        (config[key].uniq     && value === null) ||
        (pattern && pattern instanceof RegExp   && !pattern.test(value))   ||
        (pattern && typeof pattern === 'string' && !new RegExp(pattern).test(value)) ) {
      errors[key] = invalid || 'Invalid value['+value+']';
    }
  });

  return _(errors).isEmpty() ? {
                                 ok: true
                               }
                             : errors;
};
