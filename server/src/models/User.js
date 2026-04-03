const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  phone: { type: String },
  passwordHash: { type: String, required: true },
  isAdmin: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);


