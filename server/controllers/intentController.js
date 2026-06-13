const TravelIntent = require('../models/TravelIntent');
const SuggestedPool = require('../models/SuggestedPool');
const transitGraph = require('../services/GraphService');

const getCombinations = (array, min, max) => {
  const result = [];
  const f = (prefix, chars) => {
    for (let i = 0; i < chars.length; i++) {
      const next = prefix.concat([chars[i]]);
      if (next.length >= min && next.length <= max) result.push(next);
      f(next, chars.slice(i + 1));
    }
  };
  f([], array);
  return result;
};

const getLuggageScore = (size) => {
  const scores = { 'none': 0, 'backpack': 1, 'medium': 2, 'large': 3 };
  return scores[size?.toLowerCase()] || 0;
};

const processMatchmaking = async (req, res) => {
  try {
    const { userId, fromNode, toNode, departureTime, flexibilityMinutes, luggageSize, vehiclePreference, gender, genderPreference } = req.body;

    const existingIntent = await TravelIntent.findOne({ userId, status: { $in: ['active', 'pooled'] } });
    if (existingIntent) return res.status(400).json({ message: "You already have an active intent.", poolFound: false });

    const userIntent = await TravelIntent.create({
      userId, fromNode, toNode, departureTime: new Date(departureTime),
      flexibilityMinutes, passengers: 1, luggageSize, vehiclePreference, gender, genderPreference, status: 'active'
    });

    const targetTime = new Date(departureTime);
    
    // Dynamic query based on Leaving vs Returning
    const isLeavingCampus = fromNode.match(/Hall|BRH/i) != null;
    let matchQuery = { _id: { $ne: userIntent._id }, status: 'active' };

    if (isLeavingCampus) {
      matchQuery.toNode = toNode; 
      matchQuery.fromNode = { $regex: /Hall|BRH/i };
    } else {
      matchQuery.fromNode = fromNode; 
      matchQuery.toNode = { $regex: /Hall|BRH/i };
    }

    const activeIntents = await TravelIntent.find(matchQuery);

    const compatibleIntents = activeIntents.filter(intent => {
      const diffMinutes = Math.abs(targetTime - new Date(intent.departureTime)) / 60000;
      return diffMinutes <= (flexibilityMinutes + intent.flexibilityMinutes);
    });

    if (compatibleIntents.length === 0) return res.status(201).json({ message: "Intent active. Waiting for overlapping riders.", poolFound: false });

    const allCandidates = [userIntent, ...compatibleIntents];
    const candidateGroups = getCombinations(allCandidates, 2, 4); 
    let scoringPools = [];

    for (let group of candidateGroups) {
      if (!group.some(i => i._id.equals(userIntent._id))) continue; 

      const totalPassengers = group.reduce((sum, i) => sum + i.passengers, 0);
      const totalLuggageScore = group.reduce((sum, i) => sum + getLuggageScore(i.luggageSize), 0);
      
      const isOutstation = (toNode + fromNode).toLowerCase().match(/airport|howrah|sealdah|ccu/);
      let inferredVehicle = vehiclePreference === 'ANY' ? (isOutstation ? 'SEDAN' : 'TOTO') : vehiclePreference;
      
      // vehicle upgradation
      if (inferredVehicle === 'TOTO' && totalLuggageScore > 6) inferredVehicle = 'SEDAN'; 
      if (inferredVehicle === 'SEDAN' && (totalLuggageScore > 7 || totalPassengers > 3)) inferredVehicle = 'SUV'; 

      let isValidPool = true;
      let confirmationThreshold = 2;

      // vehicle + luggage thresholds checking 
      if (inferredVehicle === 'TOTO' && (totalPassengers > 4 || totalLuggageScore > 6)) isValidPool = false;
      if (inferredVehicle === 'SEDAN' && (totalPassengers > 3 || totalLuggageScore > 7)) isValidPool = false;
      if (inferredVehicle === 'SUV') {
        if (totalPassengers > 4 || totalLuggageScore > 12) isValidPool = false;
        confirmationThreshold = 3; 
      }

      if (!isValidPool) continue; 

      let routeAnalysis = transitGraph.evaluateGroupRouting(group, isLeavingCampus ? toNode : fromNode) || { totalTime: 45 };

      let uniqueStops = isLeavingCampus 
        ? [...new Set(group.map(i => i.fromNode)), toNode]
        : [fromNode, ...new Set(group.map(i => i.toNode))];

      let baseFare = inferredVehicle === 'SUV' ? 2500 : inferredVehicle === 'SEDAN' ? 1800 : 150;
      const fairFareSplit = Math.round(baseFare / totalPassengers);
      const savingsPct = Math.round(((baseFare - fairFareSplit) / baseFare) * 100);

      let score = 50 + savingsPct; 
      if (new Set(group.map(i => i.gender)).size === 1) score += 15; 
      score += (totalPassengers * 10000); 
      
      scoringPools.push({
        intents: group.map(i => i._id),
        uiStops: uniqueStops,
        inferredVehicle,
        confirmationThreshold,
        metrics: { totalTime: routeAnalysis.totalTime, estimatedFarePerPerson: fairFareSplit, savingsPercentage: savingsPct, totalLuggageScore, compatibilityScore: score }
      });
    }

    // Getting top-scored pool on feed 
    scoringPools.sort((a, b) => b.metrics.compatibilityScore - a.metrics.compatibilityScore);
    if (scoringPools.length === 0) return res.status(201).json({ message: "Intent active. Route optimizing...", poolFound: false });

    const optimalPoolData = scoringPools[0];
    
    const existingGatheringPool = await SuggestedPool.findOne({
      intents: { $in: optimalPoolData.intents },
      status: 'gathering'
    });

    let finalPool;
    if (existingGatheringPool) {
      await SuggestedPool.deleteMany({ intents: { $in: optimalPoolData.intents }, _id: { $ne: existingGatheringPool._id } });

      existingGatheringPool.intents = optimalPoolData.intents;
      existingGatheringPool.inferredVehicle = optimalPoolData.inferredVehicle;
      existingGatheringPool.metrics = optimalPoolData.metrics;
      existingGatheringPool.confirmationThreshold = optimalPoolData.confirmationThreshold;
      existingGatheringPool.uiStops = optimalPoolData.uiStops;
      
      const validIntentsIds = optimalPoolData.intents.map(id => id.toString());
      const validUsers = allCandidates.filter(c => validIntentsIds.includes(c._id.toString())).map(c => c.userId);
      existingGatheringPool.acceptances = existingGatheringPool.acceptances.filter(id => validUsers.includes(id));

      const maxCapacity = existingGatheringPool.inferredVehicle === 'SUV' ? 4 : (existingGatheringPool.inferredVehicle === 'SEDAN' ? 3 : 4);
      if (existingGatheringPool.acceptances.length >= maxCapacity) {
          existingGatheringPool.status = 'locked';
          if (existingGatheringPool.acceptances.length >= existingGatheringPool.confirmationThreshold) {
              existingGatheringPool.status = 'confirmed';
              existingGatheringPool.coordinator = existingGatheringPool.acceptances[0];
          }
      }
      
      finalPool = await existingGatheringPool.save();
    } else {
      await SuggestedPool.deleteMany({ intents: { $in: optimalPoolData.intents }, status: 'suggested' });
      finalPool = await SuggestedPool.create(optimalPoolData);
    }

    if (finalPool.status === 'confirmed') {
      await TravelIntent.updateMany({ _id: { $in: finalPool.intents } }, { $set: { status: 'pooled' } });
    }

    const populatedPool = await SuggestedPool.findById(finalPool._id).populate('intents');
    res.status(201).json({ message: "Optimal pool discovered!", poolFound: true, poolDetails: populatedPool });
  } catch (error) { res.status(500).json({ error: "Matchmaking failure." }); }
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