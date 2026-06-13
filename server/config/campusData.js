const campusNodes = [
  "RP Hall",
  "BC Roy Hall",
  "RK Hall",
  "Gokhale Hall",
  "MS Hall",
  "LLR Hall",
  "MMM Hall",
  "LBS Hall",
  "Patel Hall",
  "Nehru Hall",
  "Azad Hall",
  "BRH",
  "SNVH Hall",
  "MT Hall",
  "VGH",
  "VSRC 2",
  "VSRC",
  "SBP 1&2",
  "ABV Hall",
  "SNIG Hall",
  "RLB Hall",
  "VS Hall",
  "HJB & JCB Hall",
  "Main Gate",
  "KGP Railway Station",
  "Hijli Railway Station",
  "Sealdah Railway Station",
  "Howrah Railway Station",
  "Kolkata Airport (CCU)"
];

// ["Node A", "Node B", { distance: km, time: mins }]
const campusEdges = [

  ["RP Hall", "BC Roy Hall", { distance: 0.350, time: 1 }],
  ["RP Hall", "RK Hall", { distance: 0.1, time: 1 }],

  ["RK Hall", "Gokhale Hall", { distance: 0.25, time: 2 }],
  ["RK Hall", "MS Hall", { distance: 0.30, time: 1 }],
  ["RK Hall", "SNIG Hall", { distance: 0.35, time: 1 }],
  ["RK Hall", "BC Roy Hall", { distance: 0.3, time: 1 }],
  ["RK Hall", "RLB Hall", { distance: 0.3, time: 1 }],

  ["MS Hall", "RLB Hall", { distance: 0.30 , time: 1 }],
  ["MS Hall", "VS Hall", { distance: 0.4, time: 2 }],
  ["MS Hall", "LLR Hall", { distance: 0.25, time: 1 }],

  ["LLR Hall", "HJB & JCB Hall", { distance: 0.45, time: 2 }],
  ["LLR Hall", "MMM Hall", { distance: 0.2, time: 1 }],
  ["LLR Hall", "SNVH Hall", { distance: 0.55, time: 2 }],
  ["LLR Hall", "VS Hall", { distance: 0.45, time: 2 }],
  
  ["MMM Hall", "LBS Hall", { distance: 0.1, time: 1 }],
  
  ["LBS Hall", "Patel Hall", { distance: 0.35, time: 2 }],

  ["Patel Hall", "Nehru Hall", { distance: 0.14, time: 1 }],
  ["Patel Hall", "Azad Hall", { distance: 0.24, time: 1 }],
  ["Patel Hall", "HJB & JCB Hall", { distance: 0.3, time: 1 }],
  [ "Patel Hall","SNVH Hall", { distance: 0.8, time: 3 }],
  
  ["Nehru Hall", "Azad Hall", { distance: 0.08, time: 1 }],

  ["Azad Hall", "SNVH Hall", { distance: 0.9, time: 3 }],
  ["Azad Hall", "BRH", { distance: 0.6, time: 2 }],
  ["Azad Hall", "HJB & JCB Hall", { distance: 0.3, time: 1 }],
  
  ["BRH", "SNVH Hall", { distance: 0.9, time: 3 }],

  ["SNVH Hall", "MT Hall", { distance: 0.2, time: 1 }],
  ["SNVH Hall", "HJB & JCB Hall", { distance: 0.35, time: 1 }],
  ["SNVH Hall", "VS Hall", { distance: 0.45, time: 2 }],
  ["SNVH Hall", "VGH", { distance: 0.6, time: 2 }],
  
  ["MT Hall", "VGH", { distance: 0.4, time: 2 }],
  ["MT Hall", "ABV Hall", { distance: 2.0, time: 6 }],
  ["MT Hall", "SNIG Hall", { distance: 0.45, time: 2 }],
  
  ["VGH", "VSRC 2", { distance: 1.0, time: 4 }],

  ["VSRC 2", "VSRC", { distance: 0.27, time: 1 }],
  
  ["VSRC", "ABV Hall", { distance: 1.5 , time: 5 }],
  ["VSRC", "SBP 1&2", { distance: 1.7, time: 5 }],

  ["SBP 1&2", "ABV Hall", { distance: 0.22, time: 1 }],

  ["SNIG Hall", "BC Roy Hall", { distance: 0.05, time: 1 }],
  ["SNIG Hall", "RLB Hall", { distance: 0.22, time: 2 }],
  ["SNIG Hall", "Gokhale Hall", { distance: 0.1, time: 1 }],
  
  ["RLB Hall", "Gokhale Hall", { distance: 0.12, time: 1 }],
  ["RLB Hall", "VS Hall", { distance: 0.2, time: 1 }],

  ["VS Hall", "Gokhale Hall", { distance: 0.3, time: 1 }],
  ["VS Hall", "HJB & JCB Hall", { distance: 0.3, time: 1 }],
  
  // To Main gate 
  ["RP Hall", "Main Gate", { distance: 0.6 , time: 3 }],
  ["SNIG Hall", "Main Gate", { distance: 0.5 , time: 3 }],
  ["MT Hall", "Main Gate", { distance: 0.95 , time: 4 }],
  ["BC Roy Hall", "Main Gate", { distance: 0.5 , time: 3 }],

  // Outstaion links 
  ["Main Gate", "KGP Railway Station", { distance: 4.2 , time: 12 }],
  ["Main Gate", "Hijli Railway Station", { distance: 1.1 , time: 4 }],
  ["Main Gate", "Sealdah Railway Station", { distance: 141.0 , time: 194 }],
  ["Main Gate", "Howrah Railway Station", { distance: 126.0 , time: 170 }],
  ["Main Gate", "Kolkata Airport (CCU)", { distance: 141.0 , time: 180 }],
  
  ["Howrah Railway Station", "Sealdah Railway Station", { distance: 5.2 , time: 25 }], // Heavy Kolkata traffic
  ["Howrah Railway Station", "Kolkata Airport (CCU)", { distance: 18, time: 50 }],
  ["KGP Railway Station", "Kolkata Airport (CCU)", { distance: 137.0, time: 170 }]
];

module.exports = { campusNodes, campusEdges };