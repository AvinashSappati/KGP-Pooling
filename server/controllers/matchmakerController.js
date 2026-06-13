const TravelIntent = require('../models/TravelIntent');
const SuggestedPool = require('../models/SuggestedPool');

// Getting User Data (Active Intents & Associated Pools) 
const getUserDashboard = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing User ID" });

    // Mark expired intents automatically before fetching
    const now = new Date();
    await TravelIntent.updateMany({
      userId,
      status: 'active',
      $expr: { $lt: [{ $add: ["$departureTime", { $multiply: ["$flexibilityMinutes", 60000] }] }, now] }
    }, { $set: { status: 'expired' } });

    const activeIntents = await TravelIntent.find({ userId, status: 'active' });
    
    // Fetch Pools linked to those intents
    const intentIds = activeIntents.map(i => i._id);
    const suggestedPools = await SuggestedPool.find({ 
      intents: { $in: intentIds },
      status: { $in: ['suggested', 'accepted', 'confirmed', 'needs_reconfirmation'] }
    }).sort({ createdAt: -1 });

    res.status(200).json({ intents: activeIntents, pools: suggestedPools });
  } catch (error) {
    res.status(500).json({ error: "Failed to load dashboard." });
  }
};

// Delete Intent & Recalculate
const deleteIntent = async (req, res) => {
  try {
    const { intentId, userId } = req.body;

    // Delete the intent
    await TravelIntent.findByIdAndDelete(intentId);

    // Find any pools this intent was part of
    const affectedPools = await SuggestedPool.find({ intents: intentId });

    for (let pool of affectedPools) {
      if (pool.status === 'confirmed') {
        
        // If confirmed, drop member and flag for reconfirmation
        pool.intents = pool.intents.filter(id => id.toString() !== intentId);
        pool.acceptances = pool.acceptances.filter(id => id !== userId);
        pool.status = 'needs_reconfirmation';
        
        if (pool.intents.length < 2) {
          pool.status = 'expired'; // Kill pool if only 1 person left
        }
        await pool.save();
      } else {
        
        // If just suggested, kill the pool and let matchmaker regenerate
        pool.status = 'expired';
        await pool.save();
      }
    }

    res.status(200).json({ message: "Intent deleted and network adjusted." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete intent." });
  }
};

// Handling pool acceptance and thresholds 
const handlePoolAction = async (req, res) => {
  try {
    const { poolId, userId, action } = req.body;
    const pool = await SuggestedPool.findById(poolId);

    if (action === 'decline') {
      pool.status = 'expired'; // Kill the pool for everyone
      await pool.save();
      return res.status(200).json({ message: "Pool declined. System will regenerate." });
    }

    if (action === 'accept' && !pool.acceptances.includes(userId)) {
      pool.acceptances.push(userId);
      
      // Check if threshold is met ( 2 for Station, 3 for Airport)
      if (pool.acceptances.length >= pool.confirmationThreshold || pool.acceptances.length === pool.intents.length) {
        pool.status = 'confirmed';
        // Lock the intents so they aren't matched again
        await TravelIntent.updateMany({ _id: { $in: pool.intents } }, { $set: { status: 'pooled' } });
      } else {
        pool.status = 'accepted';
      }
      
      await pool.save();
      return res.status(200).json({ message: "Suggestion accepted!" });
    }
  } catch (error) {
    res.status(500).json({ error: "Action failed." });
  }
};

module.exports = { 
  processMatchmaking, 
  getUserDashboard, 
  deleteIntent, 
  handlePoolAction 
};