const { campusNodes, campusEdges } = require('./campusData');

// 1. The Famous Algorithm: Floyd-Warshall O(V^3)
const generateDistanceMatrix = (nodes, edges) => {
  const matrix = {};

  // Initialize the matrix with Infinity, and 0 for self-distances
  nodes.forEach(u => {
    matrix[u] = {};
    nodes.forEach(v => {
      matrix[u][v] = (u === v) ? 0 : Infinity;
    });
  });

  // Populate the matrix with known edges (Treating roads as bidirectional)
  edges.forEach(([u, v, data]) => {
    // We only need the distance for the clustering algorithm
    if (matrix[u] && matrix[u][v] !== undefined) {
      matrix[u][v] = data.distance;
      matrix[v][u] = data.distance; 
    }
  });

  // Floyd-Warshall DP execution
  nodes.forEach(k => {
    nodes.forEach(i => {
      nodes.forEach(j => {
        if (matrix[i][k] + matrix[k][j] < matrix[i][j]) {
          matrix[i][j] = matrix[i][k] + matrix[k][j];
        }
      });
    });
  });

  return matrix;
};

// 2. Precompute the matrix when the server starts
const allPairsShortestPathMatrix = generateDistanceMatrix(campusNodes, campusEdges);

/**
 * 3. O(1) Lookup Function used by the Clustering Algorithm
 * Returns the exact shortest distance between any two locations instantly.
 */
const getDistance = (nodeA, nodeB) => {
  if (!allPairsShortestPathMatrix[nodeA] || allPairsShortestPathMatrix[nodeA][nodeB] === undefined) {
    // Fallback penalty if a location isn't in the graph or is completely disconnected
    return 5; 
  }
  return allPairsShortestPathMatrix[nodeA][nodeB];
};

module.exports = { getDistance, allPairsShortestPathMatrix };