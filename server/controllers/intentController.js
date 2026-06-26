const TravelIntent = require('../models/TravelIntent');
const SuggestedPool = require('../models/SuggestedPool');
const transitGraph = require('../services/GraphService');

// Import your new System Design Engine
const { matchmakerEngine } = require('../services/matchmaker');

const processMatchmaking = async (req, res) => {
  try {
    const { userId, fromNode, toNode, departureTime, flexibilityMinutes, luggageSize, vehiclePreference, gender, genderPreference } = req.body;

    // 1. Prevent duplicate active intents
    const existingIntent = await TravelIntent.findOne({ userId, status: { $in: ['active', 'pooled'] } });
    if (existingIntent) return res.status(400).json({ message: "You already have an active intent.", poolFound: false });

    // 2. Save the user's new intent
    const userIntent = await TravelIntent.create({
      userId, fromNode, toNode, departureTime: new Date(departureTime),
      flexibilityMinutes, passengers: 1, luggageSize, vehiclePreference, gender, genderPreference, status: 'active'
    });

    // 3. Global Phase 1 Filter: Utilize the O(log N) Mongo B-Tree
    const timeLowerBound = new Date(new Date(departureTime).getTime() - flexibilityMinutes * 60000);
    const timeUpperBound = new Date(new Date(departureTime).getTime() + flexibilityMinutes * 60000);

    const isLeavingCampus = fromNode.match(/Hall|BRH/i) != null;
    let matchQuery = { status: 'active' };

    // Directional isolation
    if (isLeavingCampus) {
      matchQuery.toNode = toNode; 
      matchQuery.fromNode = { $regex: /Hall|BRH/i };
    } else {
      matchQuery.fromNode = fromNode; 
      matchQuery.toNode = { $regex: /Hall|BRH/i };
    }
    
    // Time isolation using the B-Tree index
    matchQuery.departureTime = { $gte: timeLowerBound, $lte: timeUpperBound };

    const validIntents = await TravelIntent.find(matchQuery);

    if (validIntents.length < 2) {
      return res.status(201).json({ message: "Intent active. Waiting for overlapping riders.", poolFound: false });
    }

    // 4. Execute the Agglomerative Clustering Engine
    const isOutstation = (toNode + fromNode).toLowerCase().match(/airport|howrah|sealdah|ccu/);
    const inferredVehicle = vehiclePreference === 'ANY' ? (isOutstation ? 'SEDAN' : 'TOTO') : vehiclePreference;

    // The engine mathematically clusters everyone and saves the SuggestedPools to the DB automatically
    const suggestedPools = await matchmakerEngine(validIntents, inferredVehicle);

    // 5. Fetch the specific pool the current user was placed in
    const userPool = suggestedPools.find(pool => pool.intents.includes(userIntent._id));

    if (userPool) {
      const populatedPool = await SuggestedPool.findById(userPool._id).populate('intents');
      res.status(201).json({ message: "Optimal pool discovered via Clustering Algorithm!", poolFound: true, poolDetails: populatedPool });
    } else {
      res.status(201).json({ message: "Intent active. Route optimizing...", poolFound: false });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Matchmaking Engine failure." });
  }
};

const getUserDashboard = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing User ID" });

    const now = new Date();
    await TravelIntent.updateMany({
      userId, status: 'active',
      $expr: { $lt: [{ $add: ["$departureTime", { $multiply: ["$flexibilityMinutes", 60000] }] }, now] }
    }, { $set: { status: 'expired' } });

    const activeIntents = await TravelIntent.find({ userId, status: { $in: ['active', 'pooled'] } });
    const intentIds = activeIntents.map(i => i._id);
    
    let suggestedPools = await SuggestedPool.find({ 
      intents: { $in: intentIds },
      status: { $in: ['suggested', 'gathering', 'locked', 'confirmed'] }
    })
    .populate('intents')
    .sort({ createdAt: -1 });

    for (let pool of suggestedPools) {
      if (pool.status === 'gathering') {
        const diffMins = (now - new Date(pool.gatheringStartedAt)) / 60000;
        
        if (diffMins >= 5) { 
          pool.status = 'locked';
          if (pool.acceptances.length >= pool.confirmationThreshold) {
            pool.status = 'confirmed';
            pool.coordinator = pool.acceptances[0]; 
            const intentIdsOnly = pool.intents.map(i => i._id);
            await TravelIntent.updateMany({ _id: { $in: intentIdsOnly } }, { $set: { status: 'pooled' } });
          } else { 
            pool.status = 'expired'; 
            const intentIdsOnly = pool.intents.map(i => i._id);
            await TravelIntent.updateMany({ _id: { $in: intentIdsOnly } }, { $set: { status: 'active' } });
          }
          await pool.save();
        }
      }
    }
    res.status(200).json({ intents: activeIntents, pools: suggestedPools });
  } catch (error) { res.status(500).json({ error: "Failed to load dashboard." }); }
};

const deleteIntent = async (req, res) => {
  try {
    const { intentId, userId } = req.body;
    await TravelIntent.findByIdAndDelete(intentId);
    const affectedPools = await SuggestedPool.find({ intents: intentId });

    for (let pool of affectedPools) {
      pool.intents = pool.intents.filter(id => id.toString() !== intentId);
      pool.acceptances = pool.acceptances.filter(id => id !== userId);
      
      if (pool.intents.length < 2) {
        pool.status = 'expired'; 
        await TravelIntent.updateMany({ _id: { $in: pool.intents } }, { $set: { status: 'active' } });
      } else {
        pool.status = 'gathering'; 
        const survivingIntents = await TravelIntent.find({ _id: { $in: pool.intents } });
        if (survivingIntents.length > 0) {
           const isSurvivingLeaving = survivingIntents[0].fromNode.match(/Hall|BRH/i) != null;
           if (isSurvivingLeaving) {
             pool.uiStops = [...new Set(survivingIntents.map(i => i.fromNode)), survivingIntents[0].toNode];
           } else {
             pool.uiStops = [survivingIntents[0].fromNode, ...new Set(survivingIntents.map(i => i.toNode))];
           }
           let baseFare = pool.inferredVehicle === 'SUV' ? 2500 : pool.inferredVehicle === 'SEDAN' ? 1800 : 150;
           pool.metrics.estimatedFarePerPerson = Math.round(baseFare / pool.intents.length);
           pool.metrics.savingsPercentage = Math.round(((baseFare - pool.metrics.estimatedFarePerPerson) / baseFare) * 100);
           pool.metrics.totalLuggageScore = survivingIntents.reduce((sum, i) => sum + getLuggageScore(i.luggageSize), 0);
        }
      }
      await pool.save();
    }
    res.status(200).json({ message: "Intent deleted successfully." });
  } catch (error) { res.status(500).json({ error: "Failed to delete intent." }); }
};

const handlePoolAction = async (req, res) => {
  try {
    const { poolId, userId, action } = req.body;
    const pool = await SuggestedPool.findById(poolId);

    if (action === 'decline') {
      const userIntent = await TravelIntent.findOne({ userId, status: { $in: ['active', 'pooled'] } });
      if (userIntent) pool.intents = pool.intents.filter(id => id.toString() !== userIntent._id.toString());
      pool.acceptances = pool.acceptances.filter(id => id !== userId);
      
      if (pool.intents.length >= 2) {
        pool.status = 'gathering'; 
        const survivingIntents = await TravelIntent.find({ _id: { $in: pool.intents } });
        let baseFare = pool.inferredVehicle === 'SUV' ? 2500 : pool.inferredVehicle === 'SEDAN' ? 1800 : 150;
        pool.metrics.estimatedFarePerPerson = Math.round(baseFare / pool.intents.length);
        pool.metrics.savingsPercentage = Math.round(((baseFare - pool.metrics.estimatedFarePerPerson) / baseFare) * 100);
        
        if (survivingIntents.length > 0) {
            const isSurvivingLeaving = survivingIntents[0].fromNode.match(/Hall|BRH/i) != null;
            if (isSurvivingLeaving) {
              pool.uiStops = [...new Set(survivingIntents.map(i => i.fromNode)), survivingIntents[0].toNode];
            } else {
              pool.uiStops = [survivingIntents[0].fromNode, ...new Set(survivingIntents.map(i => i.toNode))];
            }
            pool.metrics.totalLuggageScore = survivingIntents.reduce((sum, i) => sum + getLuggageScore(i.luggageSize), 0);
        }

        await pool.save();
        await TravelIntent.updateMany({ _id: { $in: pool.intents } }, { $set: { status: 'active' } });
        return res.status(200).json({ message: "Declined. Route updated for remaining riders." });
      } else {
        pool.status = 'expired'; 
        await pool.save();
        await TravelIntent.updateMany({ _id: { $in: pool.intents } }, { $set: { status: 'active' } });
        return res.status(200).json({ message: "Pool disbanded (not enough riders)." });
      }
    }

    if (action === 'interested' && !pool.acceptances.includes(userId)) {
      pool.acceptances.push(userId);
      if (pool.status === 'suggested') {
        pool.status = 'gathering';
        pool.gatheringStartedAt = new Date();
      }
      
      const maxCapacity = pool.inferredVehicle === 'SUV' ? 4 : (pool.inferredVehicle === 'SEDAN' ? 3 : 4);
      if (pool.acceptances.length >= maxCapacity) {
        pool.status = 'locked';
      }

      if (pool.status === 'locked' && pool.acceptances.length >= pool.confirmationThreshold) {
        pool.status = 'confirmed';
        pool.coordinator = pool.acceptances[0]; 
        await TravelIntent.updateMany({ _id: { $in: pool.intents } }, { $set: { status: 'pooled' } });
      }
      await pool.save();
      return res.status(200).json({ message: "Marked as interested!" });
    }
  } catch (error) { res.status(500).json({ error: "Action failed." }); }
};

module.exports = { processMatchmaking, getUserDashboard, deleteIntent, handlePoolAction };