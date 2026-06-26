const mongoose = require('mongoose');

const poolSchema = new mongoose.Schema({
  intents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TravelIntent' }],
  uiStops: [{ type: String }],
  inferredVehicle: { type: String, enum: ['TOTO', 'SEDAN', 'SUV'] },
  
  // ADDED: Required for TTL cleanup and easy frontend display
  departureTime: { type: Date, required: true }, 
  
  metrics: {
    totalTime: { type: Number },
    estimatedFarePerPerson: { type: Number },
    savingsPercentage: { type: Number },
    compatibilityScore: { type: Number },
    totalLuggageScore: { type: Number }
  },
  acceptances: [{ type: String }], 
  declines: [{ type: String }],    
  confirmationThreshold: { type: Number, required: true }, 
  
  gatheringStartedAt: { type: Date },
  coordinator: { type: String }, 
  
  status: { 
    type: String, 
    enum: ['suggested', 'gathering', 'locked', 'confirmed', 'needs_reconfirmation', 'expired', 'completed'], 
    default: 'suggested' 
  }
}, { timestamps: true });

// 🔥 UPGRADE 2: TTL Index - Auto-deletes expired pools 2 hours after departure
poolSchema.index({ departureTime: 1 }, { expireAfterSeconds: 7200 });

module.exports = mongoose.model('SuggestedPool', poolSchema);