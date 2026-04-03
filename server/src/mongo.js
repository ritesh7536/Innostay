const mongoose = require('mongoose');

async function connectToDatabase() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGO_DB || 'innostay';

  await mongoose.connect(uri, { dbName });
  console.log('MongoDB connected');
}

module.exports = { connectToDatabase };


