const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 🔴 THE FIX: req.session.save() prevents the race condition!
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173?error=domain_restricted' }), 
  (req, res) => {
    req.session.save(() => {
      res.redirect('http://localhost:5173');
    });
  }
);

router.post('/complete-profile', async (req, res) => {
  try {
    const { userId, mobile, gender, rollNo } = req.body;
    const updatedUser = await User.findByIdAndUpdate(userId, { mobile, gender, rollNo }, { new: true });
    res.status(200).json({ message: "Profile updated!", user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile." });
  }
});

router.post('/dev_login', (req, res) => {
  const { name, email, mobile, gender } = req.body;
  const mockId = "user_" + email.split('@')[0];
  const user = { _id: mockId, id: mockId, name, email, mobile, gender, rollNo: 'TEST_ACCOUNT' };
  
  req.session.passport = { user: mockId }; 
  req.session.mockUser = user; 
  req.session.save(() => {
    res.status(200).json(user);
  });
});

router.get('/current_user', (req, res) => {
  if (req.user) {
    res.status(200).json(req.user); 
  } else if (req.session && req.session.mockUser) {
    res.status(200).json(req.session.mockUser); 
  } else {
    res.status(401).json({ error: "Not logged in" });
  }
});

router.post('/logout', (req, res) => {
  if (req.logout) req.logout((err) => {});
  req.session.destroy();
  res.status(200).json({ message: "Logged out" });
});

module.exports = router;