import pluralize from 'pluralize';

module.exports = {
  schemefy: (prefix, _key, model) => {
    const json = {
      title: _key,
      type: 'object',
      properties: {},
      required: [],
      uniqueKeys: [],
    };

    Object.keys(model).forEach((key) => {
      const attr = model[key];
      json.properties[key] = {};
      if (
        !attr.type ||
        attr.type === 'number' ||
        attr.type === 'boolean' ||
        attr.type === 'string'
      ) {
        json.properties[key].type = attr.type || 'string';
      }
      if (
        attr.type === 'children' ||
        attr.type === 'parent' ||
        attr.type === 'instance'
      ) {
        json.properties[key] = {
          // TODO: Once defined proper type for children, parent, instance should be use it instead.
          type: attr.type,
          rel: attr.relation,
          href: `${prefix}/${pluralize(attr.relation)}`,
        };
      }
      if (attr.type === 'date') {
        json.properties[key].type = 'string';
        json.properties[key].format = 'date';
      }
      if (attr.pattern) {
        json.properties[key].pattern = new RegExp(attr.pattern).toString().replace(/^\/|\/$/g, '');
      }
      if (attr.uniq || attr.required) {
        json.required.push(key);
      }
      if (attr.uniq) {
        // TODO: Once defined proper attribute for unique key, it should be use instead.
        json.uniqueKeys.push(key);
      }
    });

    return json;
  },
  modelify: (json) => {
    const scheme = {
      model: {},
      key: json.title,
    };
    const properties = json.properties;
    Object.keys(properties).forEach((property) => {
      const val = properties[property];
      scheme.model[property] = {};
      scheme.model[property].type = val.type;
      if (val.pattern) {
        scheme.model[property].pattern = new RegExp(val.pattern.replace());
      }
      if (
        val.type === 'children' ||
        val.type === 'parent' ||
        val.type === 'instance'
      ) {
        scheme.model[property].type = val.type;
        scheme.model[property].relation = val.rel;
      }
    });
    (json.required || []).forEach((property) => {
      scheme.model[property].required = true;
    });
    (json.uniqueKeys || []).forEach((property) => {
      scheme.model[property].uniq = true;
    });
    return scheme;
  },
};
