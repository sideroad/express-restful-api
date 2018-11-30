var express = require('express'),
  app = express(),
  session = require('express-session'),
  bodyParser = require('body-parser'),
  creator = require('express-restful-api');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// register router
var router = creator.router({
  mongo: process.env.MONGO_URL,
  schemas: {
    // register company model
    company: {
      name: {
        uniq: true,
        required: true,
        pattern: /^[a-zA-Z _]+$/,
        desc: 'Company name',
        invalid: 'Only alphabets number spaces allowed',
      },
      president: {
        type: 'instance',
        relation: 'persion',
      },
      members: {
        type: 'children',
        relation: 'person',
      },
    },

    // register person model
    person: {
      name: {
        type: 'auth',
        uniq: true,
        required: true,
        pattern: /^[a-zA-Z _]+$/,
        resoure: 'id',
      },
      company: {
        type: 'parent',
        relation: 'company.members',
      },
      age: {
        type: 'number',
      },
    },
  },
});

app.use('/', router);

app.listen(3000);
