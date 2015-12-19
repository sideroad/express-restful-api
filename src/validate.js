var _ = require('lodash');

module.exports = function(config, params){
  var errors = [];

  _.map(params, function(value, key){
    var regexp = config[key].regexp || '';

    if( (config[key].required && !value) ||
        (regexp && regexp instanceof RegExp   && !regexp.test(value))   ||
        (regexp && typeof regexp === 'string' && !new RegExp(regexp).test(value)) ) {
      errors.push('Invalid value: key[' + key + '] value['+value+']');
    }
  });

  if(errors.length){
    return {
      msg: errors.join('\n')
    };
  }
  return {
    ok: true
  };
};