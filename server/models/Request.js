const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  requestedTime: { type: Date, required: true },
  // Let the AI know if this request is still active
  status: { type: String, enum: ['Pending', 'Matched'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Request', requestSchema);