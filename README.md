# Creating Simple Express RESTful API

## Installation

```sh
npm i --save express-restful-api
```

## Usage

```js
var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    creator = require('express-restful-api');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// register router
app.use('/', creator.router({
  mongo: process.env.MONGO_URL,
  schemas: {

    // register company model
    company: {
      name: {
        uniq: true,
        required: true,
        pattern: /^[a-zA-Z _]+$/,
        desc: "Company name",
        invalid: "Only alphabets number spaces allowed"
      },
      president: {
        type: 'instance',
        relation: 'person'
      },
      members: {
        type: 'children',
        relation: 'person'
      }
    },

    // register person model
    person: {
      name: {
        uniq: true,
        required: true,
        pattern: /^[a-zA-Z _]+$/
      },
      company: {
        type: 'parent',
        relation: 'company.members'
      },
      age: {
        type: 'number'
      }
    }
  }
}));

// create API document, if needed
creator.doc({
  "name": "RESTful API",
  "version": JSON.parse( fs.readFileSync('./package.json') ).version,
  "description": "API specification",
  "title": "API doc",
  "url" : "//express-restful-api-sample.herokuapp.com",
  "sampleUrl": "//express-restful-api-sample.herokuapp.com",
  "template": {
    "withCompare": false,
    "withGenerator": true,
    "jQueryAjaxSetup": {
      xhrFields: {
        withCredentials: true
      }
    }
  },
  "dest": __dirname + '/public/doc'
});
```

### creator.router
We can specified parameters below

|Name     |Type          |Default  | Description                                                                                                         |
|:--------|:-------------|:--------|:--------------------------------------------------------------------------------------------------------------------|
|uniq     |Boolean       |false    |This data will use to create ID. If multiple keys have `uniq` of true, ID will be `${key1}-${key2}`                  |
|required |Boolean       |false    |Enable or Disable to validate POST data. If the value is empty, 400 status code will be response                     |
|type     |String        |'string' |POST data will be store following the type. 'string', 'number', 'date', 'children', 'parent', 'relation' can be used.                                  |
|pattern   |String, RegExp|undefined|Enable or Disable to validate POST data. If the value does not match with `pattern`, 400 status code will be response |
|relation |String        |undefined|instance: The key will be have relationship with specified key. the value could be have only single value. <br><br> children: The key will be have relationship with specified key. the value could be have multiple values. <br><br> parent: If the model have relationship as children, The key should have as `parent` of `${parent model}.${key}`.|
|desc     |String        |undefined|API document use the value for description                                                                           |
|invalid  |String        |undefined|When the data is invalid, return message                                                                             |

creator.router creates CRUD below
- Get instance ( GET )
- Get collection ( GET )
- Get child collection of a instance ( GET )
- Validate parameters ( GET )
- Create instance ( POST )
- Update instance ( POST )
- Delete instance ( DELETE )
- Delete collection ( DELETE )

### Field control
You can specify response field by `fields` parameter.
Each fields should be separated with comma.

```
// Only name, age response fields should be response
...fields=name,age
```

You can expand response field by `expands` parameter which has relation of `parent` or `instance` attribution type.

##### Example
Original resource fields of person
```
{
  "name": "sideroad",
  "company": {
    "id": "8ab3de2",
    "href": "/apis/companies/8ab3de2"
  }
}
```

Fetche with `expands=company` parameter
```
{
  "name": "sideroad",
  "company": {
    "id": "8ab3de2",
    "name": "FooBar",
    "establishedAt": "2017-10-01T00:00:00+09:00",
    "createdAt": "2017-10-01T00:00:00+09:00",
    "updatedAt": "2017-10-01T00:00:00+09:00"
  }
}
```

### Fetching collection
#### Sorting
Your can specify sort order of collection.
- `+` or not specify operand sorted by parameter ascending.
- `-` operand sorted by parameter descending.
You can specify multiple prioritized order separated with comma.
Notice: operand should be encoded with URL parameter such as `%2B` in case of `+`.

```
// Get collection order by name asc, age desc.
...orderBy=name,-age
```
#### Filtering
##### type of `string`
You can use wildcard to get collection.

```
// Get collection which has name end with road
...name=*road
```

You can use comma to get collection as OR condition
```
// Get collection which value equal sideroad OR roadside
...name=sideroad,roadside
```

##### type of `number` or `date`
You can get collection filtered by range.

```
// Get collection which created the instance between 1, Dec and 5, Dec
...createdAt=[2015-12-01,2015-12-05]
```

```
// Get collection which has value between 10 and 20
...age=[10,20]
```

You can use comma to get collection as OR condition
```
// Get collection which value equal sideroad OR roadside
...age=10,20
```

### creator.doc
API document will be generated. `dest` should be specified destination of the document.
See [apidoc](https://github.com/apidoc/apidoc) to check other parameter

## Example
[express-restful-api-sample](https://github.com/sideroad/express-restful-api-sample)

## Influences
API strongly influenced great architecture [Beautiful REST + JSON APIs](http://www.slideshare.net/stormpath/rest-jsonapis)

## Change log
### 14.0.0
Change Validate method from 'GET' to 'POST'

### 13.0.0
Change property name from `schema` to `schemas`
