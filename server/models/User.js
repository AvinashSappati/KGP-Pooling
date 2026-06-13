const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String }, // For real users
  name: { type: String, required: true },
  email: { type: String, required: true },
  mobile: { type: String },
  gender: { type: String },
  rollNo: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);