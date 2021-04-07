var { MongoClient, Logger } = require("mongodb");
var bcrypt = require("bcrypt"); //for password auth
var url = "mongodb+srv://dbUser:dbPassword@cluster0.rdapr.mongodb.net/cps888?retryWrites=true&w=majority";

var db = null;
async function connect() {
    if (db == null) {
        var options = {useUnifiedTopology: true};

        var connection = await MongoClient.connect(url, options);
        connection.db("cps888");

        db = await connection.db("cps888");
    }

    return db;
}

async function register(name, username, password, role) {
    var conn = await connect(); // establish connection with database
    var SALT_ROUNDS = 10; // recomended value for hashing
    var passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const exsistingUser = await conn.collection('users').findOne({ username }); // pull from collection
    const exsistingAdvisor = await conn.collection('advisors').findOne({ username });

    if(exsistingUser != null || exsistingAdvisor != null){
        throw new Error("Username already taken!");
    }

    if(role == 'user'){
        await conn.collection('users').insertOne(
            { 
                name,
                username, 
                passwordHash, 
                financialProfile: {
                    plans : [],
                    pendingPlans : [],
                    totalFunds : 0
                }
            }
        )
    }else{
        await conn.collection('advisors').insertOne(
            { 
                name,
                username, 
                passwordHash,
                plans: [],
                advisorType : "Budget Planner" 
            }
        )
    }
}

async function login(username, password) {
    var conn = await connect();
    var user = await conn.collection('users').findOne({ username });
    var advisor = await conn.collection('advisors').findOne({ username });

    if (user == null && advisor == null) {
        throw new Error('Account does not exsist!');
    }else if(user == null){
        var valid = await bcrypt.compare(password, advisor.passwordHash);
        var role = 'advisor';
    }else{
        var valid = await bcrypt.compare(password, user.passwordHash);
        var role = 'user';
    }

    if (!valid) { 
        throw new Error("Invalid Password");
    }
    console.log("Login Successful!");
    return role;
}

async function getFunds(username){
    var conn = await connect();
    const doc = await conn.collection('users')
                            .findOne({ username: username })
    return doc.financialProfile.totalFunds;
}

async function getName(username){
    var conn = await connect();
    var user = await conn.collection('users').findOne({ username });
    var advisor = await conn.collection('advisors').findOne({ username });

    if (user == null && advisor == null) {
        throw new Error('Username: '+username+' does not have a profile!');
    }else if(user == null){
        const doc = await conn.collection('advisors')
                                .findOne({ username });
        return doc.name;
    }else{
        const doc = await conn.collection('users')
                                .findOne({ username });
        return doc.name;
    }
}

async function deleteAccount(username){
    var conn = await connect();
    await conn.collection('users').deleteOne({ username: username });
    await conn.collection('advisors').deleteOne({ username: username });
    return 0
}

async function getPlans(username, role) { // Returns all plans associated with a user
    var conn = await connect();
    var ObjectId = require('mongodb').ObjectID;

    if (role == 'user') {
        var user = await conn.collection('users').findOne({ username });
        var planIds = user.financialProfile.plans;
        
        var plans = await Promise.all(planIds.map(async function(id){
            var plan = await conn.collection('plans').findOne({"_id":ObjectId(id)});
            return plan
        }))
        return plans;

    } else {
        var user = await conn.collection('advisors').findOne({ username });
        var planIds = user.plans;
        
        var plans = await Promise.all(planIds.map(async function(id) {
            var plan = await conn.collection('plans').findOne({"_id":ObjectId(id)});
            return plan
        }))
        return plans;
    }
}

async function getPendingPlans(username) { // Returns all pending plans of given user
    var conn = await connect();
    var ObjectId = require('mongodb').ObjectID;

    var user = await conn.collection('users').findOne({ username });
    var planIds = user.financialProfile.pendingPlans;

    var plans = await Promise.all(planIds.map(async function(id){
        var plan = await conn.collection('plans').findOne({"_id":ObjectId(id)});
        return plan
    }))
    return plans;
}

async function getPlanDetails(planID) { // Returns plan json associated with given ID
    var conn = await connect();
    var ObjectId = require('mongodb').ObjectID;
    var plan = await conn.collection('plans').findOne({"_id":ObjectId(planID)})
    return plan

}

function getNames(plans) { // Returns list of plan names given a list of plans
    var names = plans.map(function(plan){
        if (plan != null){
            return plan.PlanName
        }
    })
    return names;
  }
  
function getId(user, plans, planName) { // Returns ID of a plan associated with a user given planName
    var id = null
    plans.forEach(function(plan) {
        if (plan.PlanName == planName) {
            console.log("ID: ", plan._id)
            id = plan._id;
        }
    });
    return id;
}

async function deletePlan(username, planID, role) { // Removes given plan from user plan list, and deletes plan object
    var conn = await connect();
    var ObjectId = require('mongodb').ObjectID;

    if (role == 'user') {
        var user = await conn.collection('users').findOne({ username });
        var planIds = user.financialProfile.plans;
        var i = planIds.indexOf(planID.toString())
        if (i > -1) {
            planIds.splice(i,1)
        }
        const filter = { _id: user._id };
        const updateDocument = {
            $set: {
                financialProfile: {
                    plans: planIds, 
                    pendingPlans: user.financialProfile.pendingPlans,
                    totalFunds: user.financialProfile.totalFunds,
                },
            },
        };
        const result = await conn.collection('users').updateOne(filter, updateDocument);
        
    } else {
        var user = await conn.collection('advisors').findOne({ username });
        var planIds = user.plans;
        var i = planIds.indexOf(planID.toString())
        if (i > -1) {
            planIds.splice(i,1)
        }
        const filter = { _id: user._id };
        const updateDocument = {
            $set: {
                plans: planIds, 
            },
        };
        const result = await conn.collection('advisors').updateOne(filter, updateDocument);
    }
    
    // Add this back in its just annoying to manually re-create plans so skipping the actual detele for now
    //var plan = await conn.collection('plans').deleteOne({"_id":ObjectId(planID)});
}

async function deletePendingPlan(username, planID) { // Removes given plan from user pendingPlan list, and deletes plan object
    var conn = await connect();
    var ObjectId = require('mongodb').ObjectID;

    var user = await conn.collection('users').findOne({ username });

    var planIds = user.financialProfile.pendingPlans;
    var i = planIds.indexOf(planID.toString())
    if (i > -1) {
        planIds.splice(i,1)
    }

    const filter = { _id: user._id };
    const updateDocument = {
        $set: {
            financialProfile: {
                plans: user.financialProfile.plans, 
                pendingPlans: planIds,
                totalFunds: user.financialProfile.totalFunds,
            },
        },
    };
    const result = await conn.collection('users').updateOne(filter, updateDocument)
    
    // Add this back in its just annoying to manually re-create plans so skipping the actual detele for now
    //var plan = await conn.collection('plans').deleteOne({"_id":ObjectId(planID)});
}

async function acceptPlan(username, planID) { // Removes given plan ID from pending plan list, and adds to plans list for the user
    var conn = await connect();
    var ObjectId = require('mongodb').ObjectID;

    var user = await conn.collection('users').findOne({ username });

    // Remove from pending plans
    var planIds = user.financialProfile.pendingPlans;
    var i = planIds.indexOf(planID.toString())
    if (i > -1) {
        planIds.splice(i,1)
    }
    var filter = { _id: user._id };
    var updateDocument = {
        $set: {
            financialProfile: {
                plans: user.financialProfile.plans, 
                pendingPlans: planIds,
                totalFunds: user.financialProfile.totalFunds,
            },
        },
    };
    var result = await conn.collection('users').updateOne(filter, updateDocument)

    //add to plans
    planIds = user.financialProfile.plans;
    planIds.push(planID.toString())

    filter = { _id: user._id };
    updateDocument = {
        $set: {
            financialProfile: {
                plans: planIds, 
                pendingPlans: user.financialProfile.pendingPlans,
                totalFunds: user.financialProfile.totalFunds,
            },
        },
    };
    result = await conn.collection('users').updateOne(filter, updateDocument);

}

async function sendPlan(username, planID) { // Adds plan ID to users pending plans list
    var conn = await connect();
    var ObjectId = require('mongodb').ObjectID;
    planID = planID.toString();
    var user = await conn.collection('users').findOne({ username });
    var planIds = user.financialProfile.pendingPlans;
    planIds.push(planID)

    const filter = { _id: user._id };
    const updateDocument = {
        $set: {
            financialProfile: {
                plans: user.financialProfile.plans, 
                pendingPlans: planIds,
                totalFunds: user.financialProfile.totalFunds,
            },
        },
    };
    const result = await conn.collection('users').updateOne(filter, updateDocument);
}

async function addFunds(username, amount){
    var conn = await connect();

    var existingFunds = await getFunds(username);
    console.log(existingFunds);
    // console.log("input amount: "+ amount)
    newAmount = +existingFunds + +amount;
    // console.log("new funds"+ newAmount);
    await conn.collection('users').updateOne(
        {username},
        {
            $set:{
                "financialProfile.totalFunds": newAmount,
            }
        }
    )
    console.log(await getFunds(username))
}

async function addFunds(username, amount){
    var conn = await connect();

    var existingFunds = await getFunds(username);
    console.log(existingFunds);
    // console.log("input amount: "+ amount)
    newAmount = +existingFunds + +amount;
    // console.log("new funds"+ newAmount);
    if (isNaN(existingFunds)){
        await conn.collection('users').updateOne(
            {username},
            {
                $set:{
                    "financialProfile.totalFunds": 0,
                }
            }
        )
    }else{
        await conn.collection('users').updateOne(
            {username},
            {
                $set:{
                    "financialProfile.totalFunds": newAmount,
                }
            }
        )
    }
    console.log(await getFunds(username))
}

async function removeFunds(username, amount){
    var conn = await connect();
    var invalid;
    var existingFunds = await getFunds(username);
    console.log(existingFunds);
    if (isNaN(existingFunds)){
        await conn.collection('users').updateOne(
            {username},
            {
                $set:{
                    "financialProfile.totalFunds": 0,
                }
            }
        )
    }else{    
        newAmount = +existingFunds - +amount;
        // console.log("new funds"+ newAmount);
        await conn.collection('users').updateOne(
            {username},
            {
                $set:{
                    "financialProfile.totalFunds": newAmount,
                }
            }
        )
    }
    console.log(await getFunds(username));    
}

module.exports = {
    url,
    login,
    register,
    getPlans,
    getPendingPlans,
    getId,
    getNames,
    getPlanDetails,
    deletePlan,
    deletePendingPlan,
    acceptPlan,
    sendPlan,
    getFunds,
    deleteAccount,
    getName,
    addFunds,
    removeFunds,
};