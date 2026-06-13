const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  // The TTL Trigger: This is used to auto-delete the message!
  rideDepartureTime: { type: Date, required: true }
}, { timestamps: true });

// TTL Index: Auto-nuke messages 2 hours (7200 seconds) after the ride leaves
messageSchema.index({ rideDepartureTime: 1 }, { expireAfterSeconds: 7200 });

module.exports = mongoose.model('Message', messageSchema);