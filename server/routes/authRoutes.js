const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Developer mode login : Instantly creates/logs in a test user
router.post('/dev_login', (req, res) => {
  const { name, email } = req.body;
  
  // Create a unique, deterministic ID for our 5 test users
  const mockId = "user_" + email.split('@')[0];
  
  const user = {
    _id: mockId,  
    id: mockId,   
    name: name,
    email: email,
    trustScore: 1000
  };
  
  req.session.user = user; // Save to session
  res.status(200).json(user);
});

// Check who is logged in
router.get('/current_user', (req, res) => {
  if (req.session && req.session.user) {
    res.status(200).json(req.session.user);
  } else {
    res.status(401).json({ error: "Not logged in" });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.status(200).json({ message: "Logged out" });
});

module.exports = router;