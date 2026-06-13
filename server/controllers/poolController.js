const SuggestedPool = require('../models/SuggestedPool');
const TravelIntent = require('../models/TravelIntent');

const getMyPools = async (req, res) => {
  try {
    // 1. Find all travel intents made by this user
    // We use $in to safely catch both String and ObjectId formats just in case
    const userIntents = await TravelIntent.find({ userId: userId });
    //console.log(`Found ${userIntents.length} intents for this user.`);

    if (userIntents.length === 0) {
      //console.log(`User has no active intents.`);
      return res.status(200).json([]);
    }

    // Extract the exact Intent IDs
    const intentIds = userIntents.map(intent => intent._id);
     //console.log(`Mapping to Intent IDs:`, intentIds);

    // Finding any suggested pools that include those exact intent IDs
    const myPools = await SuggestedPool.find({ intents: { $in: intentIds } })
      .sort({ createdAt: -1 }); 
    //console.log(`Success,Found ${myPools.length} associated pools. `);
    res.status(200).json(myPools);
  } catch (error) {
    console.error("Fetch Pools Error:", error);
    res.status(500).json({ error: "Failed to fetch active pools." });
  }
};

// Existing : Handlling Accept/Decline
const handlePoolResponse = async (req, res) => {
  try {
    const { poolId, userId, action } = req.body;
    
    const pool = await SuggestedPool.findById(poolId);
    if (!pool) return res.status(404).json({ error: "Target pool structural matrix missing." });

    if (action === 'decline') {
      pool.status = 'expired';
      pool.declines.push(userId);
      await pool.save();

      await TravelIntent.updateMany(
        { _id: { $in: pool.intents } },
        { $set: { status: 'pending' } }
      );

      return res.status(200).json({ message: "Recommendation declined. Re-entering match loops.", poolStatus: 'expired' });
    }

    if (action === 'accept') {
      if (!pool.acceptances.includes(userId)) {
        pool.acceptances.push(userId);
      }

      if (pool.acceptances.length === pool.intents.length || pool.acceptances.length >= 2) {
        pool.status = 'confirmed';
        await TravelIntent.updateMany(
          { _id: { $in: pool.intents } },
          { $set: { status: 'pooled' } }
        );
      } else {
        pool.status = 'accepted';
      }

      await pool.save();
      return res.status(200).json({ message: "Action logged successfully.", poolDetails: pool });
    }
  } catch (error) {
    res.status(500).json({ error: "State transition execution failure." });
  }
};

module.exports = { handlePoolResponse, getMyPools };