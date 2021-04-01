const connectMongo = require('connect-mongo');
var express = require('express');
const { Logger } = require('mongodb');
const { response } = require('../app');
var router = express.Router();
var db = require("../db")

// User login page
router.get('/login', async function(req, res) { // renders a given hbs for given endpoint
  res.render('login', { title: 'Login'})
});

router.post('/login', async function(req, res) { // renders a given hbs for given endpoint
  var {
    username,
    password,
    login,
    register
  } = req.body;

  if(register){
    res.redirect('/register');
  }else if(login){
    var role = await db.login(username, password);
    req.session.username = username;
    req.session.role = role;
    res.redirect('/');
  }
});

router.post('/register', async function(req, res) {
  var { name,
        username, 
        password, 
        role } = req.body; // these values coming from login.hbs file

  await db.register(name, username, password, role);
  req.session.username = username;
  req.session.role = role;
  console.log(role);
  res.redirect('/');
});

router.get('/register', async function(req,res){
  res.render('register');
})

// Protects pages, call this on all pages you want to protect (all pages except the login/register pages above)
function ensureLoggedIn(req, res, next) { // ensure pages cant be accessed until logged in
  if (!req.session.username) { //if no recorded username in session
    res.redirect('/login')
  } else {
    next(); //got to next page
  }
}

router.get('/', ensureLoggedIn, async function(req, res){
  const username = req.session.username;
  const role = req.session.role;
  console.log(role);
  var isUser;
  if (role == 'user'){
    isUser = true;
    res.render('accountOverview', { 
      fullName: await db.getName(username),
      username,
      isUser,
      funds: await db.getFunds(username)
    });
  } else {
    isUser = false;
    res.render('accountOverview', { 
      fullName: await db.getName(username),
      username,
      isUser
    });
  }
});

router.get('/logout', ensureLoggedIn, async function(req, res) {
  req.session.username = '';
  req.session.role = '';
  res.status(200).end();
});

router.get('/test/:planName/:person', ensureLoggedIn, async function(req, res) {
  var { username } = req.session;
  const planName = req.params.planName;
  const person = req.params.person;

  console.log("SEND");
  console.log("PLAN NAME: ", planName);
  console.log("SEND TO: ", person);
  var plans = await db.getPlans(username, "advisor");
  var planID = db.getId(username, plans, planName);

  await db.sendPlan(person, planID);
  res.status(200).end();
});

router.delete('/deleteProfile/:username', ensureLoggedIn, async function(req, res) {
  const response = await db.deleteProfile(req.params.username);
  if(!response){
    res.status(200).end();
  } else{
    res.status(500).end();
  }
});

router.get('/plans', async function(req, res) {
  var { username } = req.session;
  const role = req.session.role;
  console.log("ROLE: ", role)
  var isUser;
  if (role == 'user'){
    isUser = true;
  } else {
    isUser = false;
  }
  var plans = await db.getPlans(username, role)
  console.log("PLANS: ", plans )
  var names = db.getNames(plans)
  res.render('plans', { 
    username,
    items: names,//await db.getPlans('joe')//.then(data => {console.log(data); return data}),
    user: isUser, 
    viewPending: false,
  }); //replaces username in index file
});


router.post('/plans', async function(req, res) {
  var { username } = req.session;
  console.log("USERNAME :", username)
  const role = req.session.role;
  console.log("ROLE: ", role)
  var isUser;
  if (role == 'user'){
    isUser = true;
  } else {
    isUser = false;
  }

  if (req.body.view) { // check condition based on the existance of the delete  variable
    console.log("VIEW")
    var planName = req.body.view
    console.log("PLAN NAME: ", planName)
    var plans = await db.getPlans(username, req.session.role)
    var planID = db.getId(username, plans, planName)
    var plan = await db.getPlanDetails(planID)
    console.log(plan)
    res.render('budget', {name: plan['PlanName'], start: plan.StartDate, end: plan.EndDate, total: plan.totalSpent, categories: plan.categories, isUser: isUser})
  
  } else if (req.body.edit) {
    // ola
    console.log("EDIT")
    var planName = req.body.edit

  } else if (req.body.delete) {
    console.log("DELETE")
    var planName = req.body.delete
    var plans = await db.getPlans(username, req.session.role)
    var planID = db.getId(username, plans, planName)
    console.log("index ID: ", planID)
    await db.deletePlan(username, planID, role)
    res.redirect('/plans')

  } else if (req.body.send) {
    // console.log("SEND")
    // var planName = "plan1";//req.body.view;
    // var sendTo = req.body.stu;
    // console.log("PLAN NAME:: ", planName)
    // var plans = await db.getPlans(username, "advisor")
    // var planID = db.getId(username, plans, planName)

    // await db.sendPlan(sendTo, planID)
    // res.redirect('/plans')

  }
});

router.get('/pendingPlans', async function(req, res) {
  var { username } = req.session;
  var plans = await db.getPendingPlans(username)
  console.log("Pending PLANS: ", plans )
  var names = db.getNames(plans)
  res.render('plans', { 
    username,
    items: names,//await db.getPlans('joe')//.then(data => {console.log(data); return data}),
    user: false,
    viewPending: true,
  }); //replaces username in index file
});

router.post('/pendingPlans', async function(req, res) {
  var { username } = req.session;
  console.log("USERNAME: ", username)

  if (req.body.view) { // check condition based on the existance of the delete  variable
    console.log("VIEW")
    var planName = req.body.view
    console.log("PLAN NAME: ", planName)
    var plans = await db.getPendingPlans(username)
    var planID = db.getId(username, plans, planName)
    var plan = await db.getPlanDetails(planID)
    console.log(plan)
    res.render('budget', {name: plan['PlanName'], start: plan.StartDate, end: plan.EndDate, total: plan.totalSpent, categories: plan.categories, isUser: true})
  
  } else if (req.body.delete) {
    console.log("DELETE")
    var planName = req.body.delete
    var plans = await db.getPendingPlans(username)
    var planID = db.getId(username, plans, planName)
    console.log("index ID: ", planID)

    await db.deletePendingPlan(username, planID)
    res.redirect('/pendingPlans')

  } else if (req.body.accept) {
    console.log("ACCEPT")
    var planName = req.body.accept;
    console.log("PLAN NAME:: ", planName)
    var plans = await db.getPlans(username, 'user')
    var planID = db.getId(username, plans, planName)

    await db.acceptPlan(username, planID)
    res.redirect('/plans')

  }
});

module.exports = router;

//6063a45645a263d677595d42, 6064c88b428ee6a84059c1d4, 60639ff045a263d677595d41
