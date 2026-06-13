const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');

// 1. Google Auth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  res.redirect('http://localhost:5173'); 
});

// 2. Complete Profile Route 
router.post('/complete-profile', async (req, res) => {
  try {
    const { userId, mobile, gender, rollNo } = req.body;
    const updatedUser = await User.findByIdAndUpdate(userId, { mobile, gender, rollNo }, { new: true });
    res.status(200).json({ message: "Profile updated!", user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// 3. Sandbox Dev Login
router.post('/dev_login', (req, res) => {
  const { name, email, mobile, gender } = req.body;
  const mockId = "user_" + email.split('@')[0];
  const user = { _id: mockId, id: mockId, name, email, mobile, gender, rollNo: 'ADMIN_TEST' };
  
  req.session.passport = { user: mockId }; // Force passport session
  req.session.mockUser = user; 
  res.status(200).json(user);
});

// 4. Get Current User
router.get('/current_user', (req, res) => {
  if (req.user) {
    res.status(200).json(req.user); // Real Google User
  } else if (req.session && req.session.mockUser) {
    res.status(200).json(req.session.mockUser); // Sandbox User
  } else {
    res.status(401).json({ error: "Not logged in" });
  }
});

router.post('/logout', (req, res) => {
  req.logout && req.logout((err) => {});
  req.session.destroy();
  res.status(200).json({ message: "Logged out" });
});

module.exports = router;