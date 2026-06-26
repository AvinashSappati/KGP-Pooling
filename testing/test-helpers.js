// testing/test-helpers.js
const fromNodes = ["MS Hall", "LBS Hall", "MMM Hall", "SNIG Hall", "RK Hall", "RP Hall", "MT Hall", "Azad Hall"];
const toNodes = ["KGP Railway Station", "Hijli Railway Station", "Kolkata Airport (CCU)", "Howrah Railway Station"];
const luggageSizes = ["none", "backpack", "medium", "large"];

function generateRandomStudent(requestParams, context, ee, next) {
  // Generate a random mock user ID
  context.vars.userId = `test_kgpian_${Math.floor(Math.random() * 1000000)}`;
  
  // Pick random campus locations
  context.vars.fromNode = fromNodes[Math.floor(Math.random() * fromNodes.length)];
  context.vars.toNode = toNodes[Math.floor(Math.random() * toNodes.length)];
  
  // Randomize luggage
  context.vars.luggageSize = luggageSizes[Math.floor(Math.random() * luggageSizes.length)];
  
  // Randomize flexibility (15, 30, 45, or 60 mins)
  const flexes = [15, 30, 45, 60];
  context.vars.flexibilityMinutes = flexes[Math.floor(Math.random() * flexes.length)];
  
  return next();
}

module.exports = { generateRandomStudent };