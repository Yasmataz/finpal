var express = require('express');
const { response } = require('../app');
var router = express.Router();
var db = require("../db")

router.get('/login', async function(req, res) { // renders a given hbs for given endpoint
  res.render('login', { title: 'Login'})
});

router.get('/plans', async function(req, res) { // renders a given hbs for given endpoint
  res.render('plans', { title: 'Plans'})
});

router.post('/login', async function(req, res) {

  var { username, password, register } = req.body; // these values coming from login.hbs file
  console.log('logging in...', username);

  if (register) {
    await db.register(username, password) // these are functions in db
  } else {
    await db.login(username, password)
  }

  req.session.username = username; //adds username as a cookie
  res.redirect('/'); //redirect to homepage
});

function ensureLoggedIn(req, res, next) { // ensure pages cant be accessed until logged in
  if (!req.session.username) { //if no recorded username in session
    res.redirect('/login')
  } else {
    next(); //got to next page
  }
}

router.use(ensureLoggedIn);

router.get('/', async function(req, res){
  var { username } = req.session;
  res.render('index', { 
    username,
    items: await db.getListItems(username), 
  }); //replaces username in index file
});

router.post('/', async function(req, res) {
  var { username } = req.session;

  if (req.body.delete) { // check condition based on the existance of the delete  variable
    await db.deleteListItems(username, req.body.delete);
  } else {
    await db.addListItem(username, req.body.text);
  }

  res.redirect('/')
});

router.post('/logout', async function(req, res) {
  req.session.username = '';
  res.redirect('/')
});

router.get('/plans', async function(req, res){
  var { username } = req.session;
  res.render('plans', { 
    username,
    items: ["1", "2", "3"], 
  }); //replaces username in index file
});


module.exports = router;
