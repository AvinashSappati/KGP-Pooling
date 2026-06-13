const { campusNodes, campusEdges } = require('../config/campusData');

class GraphEngine {
  constructor() {
    this.adjacencyList = {};
    this.buildGraph();
  }

  buildGraph() {
    campusNodes.forEach(node => { this.adjacencyList[node] = {}; });
    campusEdges.forEach(edge => {
      const [nodeA, nodeB, metrics] = edge;
      if (this.adjacencyList[nodeA] && this.adjacencyList[nodeB]) {
        this.adjacencyList[nodeA][nodeB] = metrics;
        this.adjacencyList[nodeB][nodeA] = metrics;
      }
    });
  }

  findFastestPath(startNode, endNode) {
    const times = {};
    const distances = {}; 
    const backtrace = {};
    const pq = []; 

    for (let node in this.adjacencyList) {
      times[node] = Infinity;
      distances[node] = Infinity;
    }
    times[startNode] = 0;
    distances[startNode] = 0;
    pq.push({ node: startNode, time: 0 });

    while (pq.length > 0) {
      pq.sort((a, b) => a.time - b.time);
      let currentNode = pq.shift().node;

      if (currentNode === endNode) {
        let path = [];
        let lastStep = endNode;
        while (lastStep !== startNode) {
          path.unshift(lastStep);
          lastStep = backtrace[lastStep];
        }
        path.unshift(startNode);
        
        return { path, totalTime: times[endNode], totalDistance: distances[endNode] };
      }

      let neighbors = this.adjacencyList[currentNode];
      for (let neighbor in neighbors) {
        let timeToNeighbor = times[currentNode] + neighbors[neighbor].time;
        if (timeToNeighbor < times[neighbor]) {
          times[neighbor] = timeToNeighbor;
          distances[neighbor] = distances[currentNode] + neighbors[neighbor].distance;
          backtrace[neighbor] = currentNode;
          pq.push({ node: neighbor, time: timeToNeighbor });
        }
      }
    }
    return null; 
  }

  _getPermutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const current = arr[i];
      const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
      const remainingPerms = this._getPermutations(remaining);
      for (let perm of remainingPerms) {
        result.push([current].concat(perm));
      }
    }
    return result;
  }

  // Evaluate candidate groups based on physical detours and topology rules
  evaluateGroupRouting(intents, destinationNode) {
    const origins = intents.map(i => i.fromNode);
    const permutations = this._getPermutations(origins);
    
    let bestSequence = null;
    let minTime = Infinity;
    let bestFullPath = [];
    let cumulativeDistance = 0;

    // Permutation validation and detour matching
    permutations.forEach(sequence => {
      let currentTime = 0;
      let currentDistance = 0;
      let fullPath = [];
      let isValid = true;

      let currentLocation = sequence[0];
      fullPath.push(currentLocation);

      for (let i = 1; i < sequence.length; i++) {
        const nextStop = sequence[i];
        const leg = this.findFastestPath(currentLocation, nextStop);
        if (!leg) { isValid = false; break; }
        
        currentTime += leg.totalTime;
        currentDistance += leg.totalDistance;
        fullPath.push(...leg.path.slice(1));
        currentLocation = nextStop;
      }

      if (isValid) {
        const finalLeg = this.findFastestPath(currentLocation, destinationNode);
        if (finalLeg) {
          currentTime += finalLeg.totalTime;
          currentDistance += finalLeg.totalDistance;
          fullPath.push(...finalLeg.path.slice(1));

          if (currentTime < minTime) {
            minTime = currentTime;
            cumulativeDistance = currentDistance;
            bestFullPath = fullPath;
            bestSequence = sequence;
          }
        }
      }
    });

    if (!bestSequence) return null;

    // Logistics Vehicle Inference Logic
    const totalPassengers = intents.length;
    const luggageCount = intents.filter(i => i.luggageSize !== 'none').length;

    let inferredVehicle = 'Auto';
    if (totalPassengers > 4 || luggageCount >= 3) {
      inferredVehicle = 'SUV';
    } else if (totalPassengers > 2 || luggageCount > 1) {
      inferredVehicle = 'Sedan';
    }

    // Base fare calculations matching campus travel
    let baseFare = 150; // Standard Auto rate to station
    if (destinationNode.includes("Airport")) baseFare = 1500;
    if (inferredVehicle === 'Sedan') baseFare = Math.round(baseFare * 1.5);
    if (inferredVehicle === 'SUV') baseFare = Math.round(baseFare * 2.2);

    return {
      uiStops: [...bestSequence, destinationNode],
      driverRoutePath: bestFullPath,
      totalTime: minTime,
      totalDistance: cumulativeDistance,
      inferredVehicle,
      baseFare,
      totalPassengers
    };
  }
}

module.exports = new GraphEngine();