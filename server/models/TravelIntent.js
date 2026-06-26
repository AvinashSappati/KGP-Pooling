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

// 🔥 UPGRADE 2: TTL Index - Auto-deletes 2 hours (7200s) AFTER the trip departs
intentSchema.index({ departureTime: 1 }, { expireAfterSeconds: 7200 });

// 🔥 UPGRADE 1: B-Tree Compound Indexing for O(log N) Global Phase 1 Filtering
intentSchema.index({ toNode: 1, fromNode: 1, departureTime: 1 });

module.exports = mongoose.model('TravelIntent', intentSchema);