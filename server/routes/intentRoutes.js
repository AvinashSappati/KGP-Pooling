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

router.delete('/:id', async (req, res) => {
  try {
    const intentId = req.params.id;

    // 1. Delete the actual Intent
    const deletedIntent = await Intent.findByIdAndDelete(intentId);
    
    if (!deletedIntent) {
      return res.status(404).json({ error: 'Intent not found' });
    }
    
    // removing all pools intent containing 
    await Pool.updateMany(
      { intents: intentId }, // Find any pool that contains this intent
      { 
        $pull: { 
          intents: intentId,                     // Remove the intent ID
          acceptances: deletedIntent.userId      // Remove the user's acceptance
        } 
      }
    );

    // Delete any pools that now have 1 or 0 intents left
    await Pool.deleteMany({ 'intents.1': { $exists: false } });

    res.status(200).json({ message: 'Intent and associated pools successfully cleaned up' });
    
  } catch (err) {
    console.error("Delete & Cleanup Error:", err);
    res.status(500).json({ error: 'Server failed to delete intent' });
  }
});

// Broadcasting a new Travel Intent & trigger Matchmaker
router.post('/request-ride', processMatchmaking);

// Fetching the user's dashboard (Active Intents + Live Pools)
router.get('/dashboard', getUserDashboard);

// Delete an active Intent & automatically adjust affected pools.
router.post('/delete', deleteIntent);

// Respond to a Suggested Pool (Accept/Decline)
router.post('/respond', handlePoolAction);

module.exports = router;