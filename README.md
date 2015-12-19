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
  scheme: {

    // register company model
    company: {
      name: {
        uniq: true,
        required: true,
        regexp: /^[a-zA-Z _]+$/
      },
      president: {
        instance: 'persion'
      },
      members: {
        children: 'person'
      }
    },

    // register person model
    person: {
      name: {
        uniq: true,
        required: true,
        regexp: /^[a-zA-Z _]+$/
      },
      company: {
        parent: 'company.members'
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
|type     |String        |'string' |POST data will be store following the type. 'string', 'number', 'date' can be used.                                  |
|regexp   |String, RegExp|undefined|Enable or Disable to validate POST data. If the value does not match with `regexp`, 400 status code will be response |
|instance |String        |undefined|The key will be have relationship with specified key. the value could be have only single value                      |
|children |String        |undefined|The key will be have relationship with specified key. the value could be have multiple values                        |
|parent   |String        |undefined|If the model have relationship as children, The key should have as `parent` of `${parent model}.${key}`.             |                                |
|desc     |String        |undefined|API document use the value for description                                                                           |

creator.router creates CRUD below
- Get instance ( GET )
- Get collection ( GET )
- Get child collection of a instance ( GET )
- Create instance ( POST )
- Update instance ( POST )
- Delete instance ( DELETE )
- Delete collection ( DELETE )

#### Search
##### type of `string`
You can use wildcard to get collection.

```
// Get collection which has name end with road
...name=*road
```

##### type of `number` or `date`
You can search by range.

```
// Get collection which created the instance between 1, Dec and 5, Dec
...createdAt=[2015-12-01,2015-12-05]...
```

```
// Get collection which has value between 10 and 20
...age=[10,20]...
```

### creator.doc
API document will be generated. `dest` should be specified destination of the document.
See [apidoc](https://github.com/apidoc/apidoc) to check other parameter

## Example
[express-restful-api-sample](https://github.com/sideroad/express-restful-api-sample)

## Influences
API strongly influenced great architecture [Beautiful REST + JSON APIs](http://www.slideshare.net/stormpath/rest-jsonapis)








