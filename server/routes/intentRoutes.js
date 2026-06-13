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

// Broadcasting a new Travel Intent & trigger Matchmaker
router.post('/request-ride', processMatchmaking);

// Fetching the user's dashboard (Active Intents + Live Pools)
router.get('/dashboard', getUserDashboard);

// Delete an active Intent & automatically adjust affected pools.
router.post('/delete', deleteIntent);

// Respond to a Suggested Pool (Accept/Decline)
router.post('/respond', handlePoolAction);

module.exports = router;