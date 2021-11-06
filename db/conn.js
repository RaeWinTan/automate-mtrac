const { MongoClient } = require("mongodb");
const fs = require('fs');
const connectionString = process.env.ATLAS_URI;
const client = new MongoClient(connectionString,{ useNewUrlParser: true, useUnifiedTopology: true });

let dbConnection;

module.exports = {
  connectToServer: function (callback) {
    client.connect(function (err, db) {
      if (err || !db) {
        return callback(err);
      }

      dbConnection = db.db("mtrac");
      console.log("Successfully connected to MongoDB.");
      return callback();
    });
  },
  getDb: function () {
    return dbConnection;
  }
};
