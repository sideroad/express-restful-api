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
  schema: {

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
        relation: 'persion'
      },
      members: {
        type: 'children',
        relation: 'person'
      }
    },

    // register person model
    person: {
      name: {
        type: 'auth',
        uniq: true,
        required: true,
        pattern: /^[a-zA-Z _]+$/,
        resoure: 'id'
      },
      company: {
        type: 'parent',
        relation: 'company.members'
      },
      age: {
        type: 'number'
      }
    }
  },
  auth: {
    connect: 'github2',
    client: process.env.GITHUB_CLIENT_ID,
    secret: process.env.GITHUB_CLIENT_SECRET
  }
});

var passport = creator.passport();
app.use(session({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

app.use('/', router);

app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }),
  function(req, res){
    // The request will be redirected to GitHub for authentication, so this
    // function will not be called.
  });

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/github');
  });

app.listen(3000);
