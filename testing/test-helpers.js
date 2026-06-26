const fromNodes = ["MS Hall", "LBS Hall", "MMM Hall", "SNIG Hall", "RK Hall", "RP Hall", "MT Hall", "Azad Hall"];
const toNodes = ["KGP Railway Station", "Hijli Railway Station", "Kolkata Airport (CCU)", "Howrah Railway Station"];
const luggageSizes = ["none", "backpack", "medium", "large"];

// 🔥 FIXED: Updated parameters to match Artillery's Flow context
function generateRandomStudent(userContext, events, done) {
  // We use userContext.vars instead of context.vars
  userContext.vars.userId = `test_kgpian_${Math.floor(Math.random() * 1000000)}`;
  userContext.vars.fromNode = fromNodes[Math.floor(Math.random() * fromNodes.length)];
  userContext.vars.toNode = toNodes[Math.floor(Math.random() * toNodes.length)];
  userContext.vars.luggageSize = luggageSizes[Math.floor(Math.random() * luggageSizes.length)];
  
  const flexes = [15, 30, 45, 60];
  userContext.vars.flexibilityMinutes = flexes[Math.floor(Math.random() * flexes.length)];
  
  // 🔥 FIXED: Return done() to let Artillery proceed to the API call
  return done();
}

module.exports = { generateRandomStudent };