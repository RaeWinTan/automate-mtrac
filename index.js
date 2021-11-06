//require('dotenv').config({ path: './config.env' });
const PORT = process.env.PORT || 3000;
const axios = require('axios');
const express = require('express');
var bodyParser = require('body-parser');
var jwt = require('express-jwt');
const session = require('express-session');
const app = express();
const mongoose = require('mongoose');
const dbo = require('./db/conn');


app.use(session({secret: "as;odfi928r9eh9wtuhHH#@*$Okghsf0sd", resave: false,
  saveUninitialized: true,
  cookie: { secure: true }}));
/* Create token to be used */
app.use( bodyParser.json());

const requireLogin = () => {
  return (req, res, next) => {
    if (!req.session.email) {
        res.send(401, {"message":"MUST LOGIN FIRST"});
    } else {
      next();
    }
  }
}

app.get('/', function(req, res) {
  res.send('This is the API server');
});

app.get("/api/getDefault", requireLogin(), (req,res)=>{
  const dbConnect = dbo.getDb();
  dbConnect.collection("mtracDefaultData").findOne({
    "_id":{"email":req.session.email}
  }).then((result)=>{
    res.send(result);
  },(err)=>{
    res.send.status("DB ERROR");
  });
})

app.post("/api/recommendAvi", requireLogin(), (req, res)=>{
  const dbConnect = dbo.getDb();
  dbConnect.collection("vehicleAvi").findOne({
    "vehicleNo":req.body.vehicleNo
  }).then((result)=>{
    res.send(result);
  },(err)=>{
    res.send.status("DB ERROR");
  });
})

app.post("/api/saveDefault",requireLogin(), (req,res)=>{
  let t = req.body;
  t.hubId = req.session.hubid;
  t.nodeId = req.session.nodeid;
  let formData = {
    "_id":{email:req.session.email},
    defaultForm:t
  };
  const dbConnect = dbo.getDb();
  dbConnect.collection("mtracDefaultData")
  .updateOne({"_id":{"email":formData["_id"].email}}, {"$set":formData},{upsert:true})
  .then((result)=>{
    res.status(200).send();
  },
  (err)=>{
    res.status(501).send({error:"DB ERROR"});
  })
})



app.route('/api/login').post((req, res) => {


  axios.post('https://mtrac.ado.sg/api/auth/login', req.body, {timeout:2000})
    .then(function (response) {
      req.session.email = req.body.email;
      req.session.hubid = response.data.node.hub.id;
      req.session.nodeid = response.data.node.id;
      let accessToken = response.data.accessToken;
      req.session.accessToken = accessToken;
      return res.send({"token":accessToken});
    })
    .catch(function (error) {
      console.log(error);
      if(!error.response.data){
        return res.send(422, {"message":"Something went wrong"});
      }
      else if(!error.response.data.message){
        return res.send(422, {"message":error});
      }
      else{
        return res.send(401,{"message":error.response.data.message});
      }
    });
})

app.post("/api/sendRac",requireLogin(), (req,res)=>{
  let s = 200;
  let t = req.body;
  t.hubId = req.session.hubid;
  t.nodeId = req.session.nodeid;
  const dbConnect = dbo.getDb();
  axios.post('https://mtrac.ado.sg/api/rac',t, {timeout:2000, headers:{"authorization":`Bearer ${req.session.accessToken}`}})
    .then(function(response){
    //date must be year-month-day
    dbConnect.collection("vehicleAvi")
    .updateOne({"vehicle":req.body.vehicleNo}, {"$set":{vehicleNo:req.body.vehicleNo, aviDate:req.body.aviDate}},{upsert:true})
    .then(()=>{
      dbConnect.collection("mtracDefaultData")
      .insertOne({"_id":{"email":req.session.email},"defaultForm":t}, {"$set":{vehicleNo:req.body.vehicleNo, aviDate:req.body.aviDate}},{upsert:true})
      .then(()=>{
        s = 201;
      },(err)=>{
      });
    },(err)=>{
      res.status(501).send({error:"DB ERROR"});
    });
    res.status(s).send({id:response.data.id});
    })
    .catch(function (err){
      if(!err.response.data.message) res.status(500).send({error:err});
      else res.status(501).send({error:err.response.data.message});
    });
})

dbo.connectToServer(function (err) {
  if (err) {
    console.log("DB SERVER DONONCOU COUNNED");
    process.exit();
  }
  app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
  });
});
