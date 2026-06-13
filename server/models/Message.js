const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  senderId: { type: String, required: true }, 
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  rideDepartureTime: { type: Date, required: true }
}, { timestamps: true });

messageSchema.index({ rideDepartureTime: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('Message', messageSchema);