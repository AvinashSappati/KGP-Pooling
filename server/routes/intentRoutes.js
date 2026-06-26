// server/routes/intentRoutes.js
const express = require('express');
const router = express.Router();

const { 
  processMatchmaking,  // Creates the Intent & runs the Graph engine
  getUserDashboard,    // Fetches Active Intents + Suggested Pools
  deleteIntent,        // Deletes Intent & Recalculates Pools
  handlePoolAction     // Accepts/Declines Pools & handles thresholds
} = require('../controllers/intentController');

// Core api routes 
// THE TESTING BACKDOOR MIDDLEWARE
const requireAuth = (req, res, next) => {
  // 1. THE BYPASS: If we are running Artillery, skip Google OAuth entirely
  if (process.env.NODE_ENV === 'testing') {
    return next(); 
  }
  
  // 2. PRODUCTION: Ensure real users are actually logged in via Passport.js
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  // 3. THE BOUNCER: Kick them out if they aren't logged in and we aren't testing
  return res.status(401).json({ error: "Unauthorized. Please log in." });
};
// Broadcasting a new Travel Intent & trigger Matchmaker
router.post('/request-ride', processMatchmaking);

// Fetching the user's dashboard (Active Intents + Live Pools)
router.get('/dashboard', getUserDashboard);

// Delete an active Intent & automatically adjust affected pools.
router.post('/delete', deleteIntent);

// Respond to a Suggested Pool (Accept/Decline)
router.post('/respond', handlePoolAction);

module.exports = router;