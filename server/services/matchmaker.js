const { getDistance } = require('../config/pre-computedpathmatrix');
const SuggestedPool = require('../models/SuggestedPool');

/**
 * PHASE 1: Helper to check if two flexible time windows mathematically overlap.
 */
const timesOverlap = (intentA, intentB) => {
  const startA = new Date(intentA.departureTime.getTime() - intentA.flexibilityMinutes * 60000);
  const endA = new Date(intentA.departureTime.getTime() + intentA.flexibilityMinutes * 60000);
  const startB = new Date(intentB.departureTime.getTime() - intentB.flexibilityMinutes * 60000);
  const endB = new Date(intentB.departureTime.getTime() + intentB.flexibilityMinutes * 60000);

  return Math.max(startA, startB) <= Math.min(endA, endB);
};

/**
 * PHASE 2: Agglomerative Hierarchical Clustering Engine
 */
const runClustering = (intents, maxVehicleCapacity) => {
  // Start by treating everyone as their own isolated cluster
  let clusters = intents.map(intent => [intent]);
  let isMerging = true;

  while (isMerging) {
    isMerging = false;
    let minDistance = Infinity;
    let bestPair = null;

    // Compare every cluster against every other cluster
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const clusterA = clusters[i];
        const clusterB = clusters[j];

        // Constraint 1: Vehicle Capacity Limit
        const totalPassengers = [...clusterA, ...clusterB].reduce((sum, item) => sum + (item.passengers || 1), 0);
        if (totalPassengers > maxVehicleCapacity) continue;

        // Constraint 2: Strict Time Overlap
        let timeConflict = false;
        for (const a of clusterA) {
          for (const b of clusterB) {
            if (!timesOverlap(a, b)) {
              timeConflict = true;
              break;
            }
          }
          if (timeConflict) break;
        }
        if (timeConflict) continue;

        // Calculate Average Linkage Distance using the O(1) Precomputed Matrix
        let totalDistance = 0;
        let pairsCount = 0;
        for (const a of clusterA) {
          for (const b of clusterB) {
            totalDistance += getDistance(a.fromNode, b.fromNode);
            pairsCount++;
          }
        }
        const avgDistance = totalDistance / pairsCount;

        // Find the absolute closest pair to merge
        if (avgDistance < minDistance) {
          minDistance = avgDistance;
          bestPair = { i, j };
        }
      }
    }

    // Merge the closest valid clusters and loop again
    if (bestPair) {
      const mergedCluster = [...clusters[bestPair.i], ...clusters[bestPair.j]];
      clusters = clusters.filter((_, index) => index !== bestPair.i && index !== bestPair.j);
      clusters.push(mergedCluster);
      isMerging = true; 
    }
  }

  return clusters;
};

/**
 * MAIN PIPELINE EXPORT
 */
const matchmakerEngine = async (validIntents, vehicleType) => {
  // TOTO = 4, SEDAN = 3, SUV = 4
  const maxCap = vehicleType === 'SEDAN' ? 3 : 4;

  if (!validIntents || validIntents.length === 0) return [];

  // Run the math
  const clusteredGroups = runClustering(validIntents, maxCap);
  const createdPools = [];

  // Convert math clusters into MongoDB SuggestedPools
  for (const group of clusteredGroups) {
    if (group.length <= 1) continue; // Skip single-person pools

    const averageTimeMs = group.reduce((sum, intent) => sum + intent.departureTime.getTime(), 0) / group.length;
    const consensusDepartureTime = new Date(averageTimeMs);
    const stops = [...new Set(group.map(intent => intent.fromNode))];

    const newPool = new SuggestedPool({
      intents: group.map(intent => intent._id),
      uiStops: stops,
      inferredVehicle: vehicleType,
      departureTime: consensusDepartureTime,
      confirmationThreshold: group.length,
      status: 'suggested',
      metrics: {
        compatibilityScore: 100,
        totalLuggageScore: group.reduce((sum, item) => sum + (item.luggageSize === 'large' ? 3 : 1), 0)
      }
    });

    await newPool.save();
    createdPools.push(newPool);
  }

  return createdPools;
};

module.exports = { matchmakerEngine };