import { expect } from 'chai';
import { schemefy, modelify } from '../src/json-scheme';

describe('json-scheme', () => {
  it('should convert to JSON scheme from model', () => {
    expect(schemefy('/api', 'company', {
      name: {
        uniq: true,
        pattern: /^[a-zA-Z 0-9]+$/,
        invalid: 'Only alphabets number spaces allowed',
      },
      members: {
        type: 'children',
        relation: 'person',
      },
      president: {
        type: 'instance',
        relation: 'person',
      },
      location: {
        type: 'string',
        pattern: /^[a-zA-Z]+$/,
        invalid: 'Only alphabets allowed',
      },
      isStockListing: {
        type: 'boolean',
      },
    })).to.deep.equal({
      properties: {
        isStockListing: {
          type: 'boolean',
        },
        location: {
          pattern: '^[a-zA-Z]+$',
          type: 'string',
        },
        members: {
          href: '/api/people',
          rel: 'person',
          type: 'children',
        },
        name: {
          pattern: '^[a-zA-Z 0-9]+$',
          type: 'string',
        },
        president: {
          href: '/api/people',
          rel: 'person',
          type: 'instance',
        },
      },
      required: [
        'name',
      ],
      uniqueKeys: [
        'name',
      ],
      title: 'company',
      type: 'object',
    });
  });
  it('should convert to model from JSON Scheme', () => {
    expect(modelify({
      properties: {
        isStockListing: {
          type: 'boolean',
        },
        location: {
          pattern: '^[a-zA-Z]+$',
          type: 'string',
        },
        members: {
          href: '/api/people',
          rel: 'person',
          type: 'children',
        },
        name: {
          pattern: '^[a-zA-Z 0-9]+$',
          type: 'string',
        },
        president: {
          href: '/api/people',
          rel: 'person',
          type: 'instance',
        },
      },
      required: [
        'name',
      ],
      uniqueKeys: [
        'name',
      ],
      title: 'company',
      type: 'object',
    })).to.deep.equal({
      model: {
        name: {
          uniq: true,
          required: true,
          type: 'string',
          pattern: /^[a-zA-Z 0-9]+$/,
        },
        members: {
          type: 'children',
          relation: 'person',
        },
        president: {
          type: 'instance',
          relation: 'person',
        },
        location: {
          type: 'string',
          pattern: /^[a-zA-Z]+$/,
        },
        isStockListing: {
          type: 'boolean',
        },
      },
      key: 'company',
    });
  });
});
