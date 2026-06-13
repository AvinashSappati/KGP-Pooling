const mongoose = require('mongoose');
const rideSchema = new mongoose.Schema({
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  departureTime: { type: Date, required: true },
  totalSeats: { type: Number, required: true },
  availableSeats: { type: Number, required: true },
  passengers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  vehicleType: { type: String, enum: ['Auto', 'Cab', 'Bike'], required: true },
  totalFare: { type: Number, required: true }
}, { timestamps: true });
rideSchema.index({ departureTime: 1 }, { expireAfterSeconds: 7200 }); // Auto-Nukes 2 hours after departure
module.exports = mongoose.model('Ride', rideSchema);