var express = require('express');
const { Logger } = require('mongodb');
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
  var plans = await db.getPlans('joe')
  var names = db.getNames(plans)
  res.render('plans', { 
    username,
    items: names//await db.getPlans('joe')//.then(data => {console.log(data); return data}), 
  }); //replaces username in index file
});

// router.post('/', async function(req, res) {
//   var { username } = req.session;

//   if (req.body.delete) { // check condition based on the existance of the delete  variable
//     await db.deleteListItems(username, req.body.delete);
//   } else {
//     await db.addListItem(username, req.body.text);
//   }

//   res.redirect('/')
// });

router.post('/', async function(req, res) {
  var { username } = req.session;
  

  if (req.body.view) { // check condition based on the existance of the delete  variable
    console.log("VIEW")
    var planName = req.body.view
    console.log("PLAN NAME: ", planName)
    var plans = await db.getPlans('joe')
    var planID = db.getId("joe", plans, planName)
    var plan = await db.getPlanDetails(planID)
    console.log(plan)
    res.render('budget', {name: plan['PlanName'], start: plan.StartDate, end: plan.EndDate, total: plan.totalSpent, categories: plan.categories})
  } else if (req.body.edit) {
    // ola
    console.log("EDIT")
    var planName = req.body.edit

  } else if (req.body.delete) {
    console.log("DELETE")
    var planName = req.body.delete
    var plans = await db.getPlans('joe')
    var planID = db.getId("joe", plans, planName)
    //await db.deletePlan("joe", planID)
  }
});

router.post('/logout', async function(req, res) {
  req.session.username = '';
  res.redirect('/')
});


module.exports = router;
