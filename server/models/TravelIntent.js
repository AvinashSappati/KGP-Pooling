const mongoose = require('mongoose');

const intentSchema = new mongoose.Schema({
  userId: { type: String, required: true }, 
  fromNode: { type: String, required: true },
  toNode: { type: String, required: true },
  departureTime: { type: Date, required: true },
  flexibilityMinutes: { type: Number, default: 20 },
  passengers: { type: Number, default: 1 },
  luggageSize: { type: String, enum: ['none', 'backpack', 'medium', 'large'], default: 'none' },
  vehiclePreference: { type: String, enum: ['ANY', 'TOTO', 'SEDAN', 'SUV'], default: 'ANY' },
  gender: { type: String, enum: ['male', 'female'], required: true },
  genderPreference: { type: String, enum: ['none', 'prefer_same_gender', 'same_gender_only'], default: 'none' },
  status: { type: String, enum: ['active', 'pooled', 'expired', 'cancelled'], default: 'active' }
}, { timestamps: true });

// Auto-deletes 24 hours AFTER the trip actually departs
intentSchema.index({ departureTime: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('TravelIntent', intentSchema);