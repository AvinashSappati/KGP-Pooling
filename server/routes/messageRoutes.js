const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// Fetch all messages for a specific ride
router.get('/:rideId', async (req, res) => {
  try {
    const messages = await Message.find({ rideId: req.params.rideId }).sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save a new message to the DB
router.post('/', async (req, res) => {
  try {
    const { rideId, senderId, senderName, text, rideDepartureTime } = req.body;
    
    const newMessage = await Message.create({
      rideId,
      senderId,
      senderName,
      text,
      rideDepartureTime
    });
    
    res.status(201).json(newMessage);
  } catch (err) {
    console.error("Message Save Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;