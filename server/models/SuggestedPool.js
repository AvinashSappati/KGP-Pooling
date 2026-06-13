const mongoose = require('mongoose');

const poolSchema = new mongoose.Schema({
  intents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TravelIntent' }],
  uiStops: [{ type: String }],
  inferredVehicle: { type: String, enum: ['TOTO', 'SEDAN', 'SUV'] },
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

module.exports = mongoose.model('SuggestedPool', poolSchema);