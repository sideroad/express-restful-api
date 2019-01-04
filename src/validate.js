import _ from 'lodash';

module.exports = (config, params, isPartialMatch) => {
  const errors = {};

  _.map(isPartialMatch ? params : config, (_value, key) => {
    const pattern = config[key].pattern || '';
    const { invalid } = config[key];
    const value = params[key];

    if (
      (config[key].required && value === undefined)
      || (config[key].uniq && value === undefined)
      || (config[key].required && value === '')
      || (config[key].uniq && value === '')
      || (config[key].required && value === null)
      || (config[key].uniq && value === null)
      || (pattern && pattern instanceof RegExp && !pattern.test(value))
      || (pattern && typeof pattern === 'string' && !new RegExp(pattern).test(value))
    ) {
      errors[key] = invalid || `Invalid value[${value}]`;
    }
  });

  return _(errors).isEmpty()
    ? {
      ok: true
    }
    : errors;
};
