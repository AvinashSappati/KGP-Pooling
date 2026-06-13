const Ride = require('../models/Ride');

const getFeed = async (req, res) => {
  try {
    const rides = await Ride.find({ departureTime: { $gt: new Date() } })
                            .populate('hostId', 'name avatar trustScore')
                            .sort({ departureTime: 1 });
    res.status(200).json(rides);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const createRide = async (req, res) => {
  try {
    const newRide = new Ride(req.body);
    const savedRide = await newRide.save();
    res.status(201).json(savedRide);
  } catch (err) {
    console.error("Create Error:", err.message);
    res.status(400).json({ error: err.message });
  }
};

const joinRide = async (req, res) => {
  try {
    const { userId } = req.body;
    const ride = await Ride.findById(req.params.id);
    
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.availableSeats <= 0) return res.status(400).json({ error: "Pool is full" });
    if (ride.passengers.includes(userId)) return res.status(400).json({ error: "Already joined" });

    ride.passengers.push(userId);
    ride.availableSeats -= 1;
    await ride.save();
    res.status(200).json(ride);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteRide = async (req, res) => {
  try {
    const rideId = req.params.id;
    const userId = req.body.userId; 
    
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    // Bulletproof Object ID check
    const actualHostId = ride.hostId._id ? ride.hostId._id.toString() : ride.hostId.toString();

    if (actualHostId !== userId) {
      return res.status(403).json({ error: "Only the host can delete this ride." });
    }

    await Ride.findByIdAndDelete(rideId);
    res.status(200).json({ message: "Ride successfully deleted." });
  } catch (err) {
    console.error("DELETE ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getFeed, createRide, joinRide, deleteRide };