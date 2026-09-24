// Warborn source split from the original game.js.
// Section: js/systems/diplomacy.js

// ========== DIPLOMACY SYSTEM FUNCTIONS ==========

function initializeDiplomacy() {
  const allTeams = getActiveTeams();
  
  // Initialize trust matrix - bilateral relationships
  diplomacy.trust = {};
  allTeams.forEach(team1 => {
    diplomacy.trust[team1] = {};
    allTeams.forEach(team2 => {
      if (team1 !== team2) {
        diplomacy.trust[team1][team2] = -85;
      }
    });
  });
  
  // Initialize global reputation for each faction
  diplomacy.reputation = {};
  allTeams.forEach(team => {
    diplomacy.reputation[team] = Math.random() * 20 - 10; // Start between -10 and +10
  });
  
  // Assign AI personalities randomly
  diplomacy.personalities = {};
  const personalityTypes = Object.keys(AI_PERSONALITIES);
  allTeams.forEach(team => {
    if (isAITeam(team)) {
      const randomPersonality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];
      diplomacy.personalities[team] = randomPersonality;
      console.log(`${team} assigned personality: ${AI_PERSONALITIES[randomPersonality].name}`);
    }
  });
  
  // Initialize empty treaties and history
  diplomacy.treaties = [];
  diplomacy.diplomaticHistory = [];
  diplomacy.espionage = {};
  
  // Initialize war declarations and AI messages
  diplomacy.warDeclarations = [];
  for (let i = 0; i < allTeams.length; i++) {
    for (let j = i + 1; j < allTeams.length; j++) {
      diplomacy.warDeclarations.push({
        attacker: allTeams[i],
        target: allTeams[j],
        declaredTurn: 0,
        canAttackTurn: 0,
        active: true,
        reason: 'Default scenario start'
      });
    }
  }
  diplomacy.aiMessages = [];
  diplomacy.unreadMessages = 0;
  
  console.log('Diplomacy system initialized with', allTeams.length, 'factions');
}

function getTrust(faction1, faction2) {
  return diplomacy.trust[faction1]?.[faction2] ?? 0;
}

function getReputation(faction) {
  return diplomacy.reputation[faction] ?? 0;
}

function modifyTrust(faction1, faction2, change, reason) {
  if (!diplomacy.trust[faction1]) diplomacy.trust[faction1] = {};
  if (!diplomacy.trust[faction2]) diplomacy.trust[faction2] = {};
  
  const oldTrust1 = diplomacy.trust[faction1][faction2] ?? 0;
  const oldTrust2 = diplomacy.trust[faction2][faction1] ?? 0;
  
  diplomacy.trust[faction1][faction2] = Math.max(-100, Math.min(100, oldTrust1 + change));
  diplomacy.trust[faction2][faction1] = Math.max(-100, Math.min(100, oldTrust2 + change));
  
  // Log diplomatic action
  diplomacy.diplomaticHistory.push({
    turn: turnNumber || 0,
    action: reason,
    participants: [faction1, faction2],
    trustChange: change
  });
  
  console.log(`${reason}: Trust between ${faction1} and ${faction2} changed by ${change}`);
}

function modifyReputation(faction, change, reason) {
  const oldRep = diplomacy.reputation[faction] ?? 0;
  diplomacy.reputation[faction] = Math.max(-100, Math.min(100, oldRep + change));
  
  console.log(`${reason}: ${faction} reputation changed by ${change} (now ${diplomacy.reputation[faction]})`);
}

function createTreaty(faction1, faction2, treatyType, customDuration = null) {
  const duration = customDuration ?? TREATY_TYPES[treatyType].duration;
  const treaty = {
    id: Date.now() + Math.random(),
    type: treatyType,
    participants: [faction1, faction2],
    turnsRemaining: duration,
    active: true,
    createdTurn: turnNumber || 0
  };
  
  diplomacy.treaties.push(treaty);
  
  if (['NON_AGGRESSION', 'DEFENSIVE_PACT', 'TRADE_AGREEMENT'].includes(treatyType)) {
    endWarBetween(faction1, faction2, `${TREATY_TYPES[treatyType].name} signed`);
  }
  
  // Improve trust for signing treaty
  modifyTrust(faction1, faction2, 15, `Signed ${TREATY_TYPES[treatyType].name}`);
  
  console.log(`Treaty signed: ${TREATY_TYPES[treatyType].name} between ${faction1} and ${faction2} for ${duration} turns (Turn ${turnNumber})`);
  return treaty;
}

function endWarBetween(faction1, faction2, reason = 'Peace agreement') {
  if (!diplomacy || !Array.isArray(diplomacy.warDeclarations)) return false;
  
  let ended = false;
  diplomacy.warDeclarations.forEach(war => {
    if (war.active &&
        ((war.attacker === faction1 && war.target === faction2) ||
         (war.attacker === faction2 && war.target === faction1))) {
      war.active = false;
      war.endedTurn = turnNumber || 0;
      war.endReason = reason;
      ended = true;
    }
  });
  
  if (ended) {
    modifyTrust(faction1, faction2, 10, reason);
    addAIMessage(isAITeam(faction1) ? faction1 : faction2, `Hostilities between ${faction1} and ${faction2} have ended.`, 'PEACE_RESPONSE');
    console.log(`War ended between ${faction1} and ${faction2}: ${reason}`);
  }
  
  return ended;
}

function applyDefensivePactResponses(defender, attacker) {
  const defensiveAllies = diplomacy.treaties.filter(treaty =>
    treaty.active &&
    treaty.type === 'DEFENSIVE_PACT' &&
    treaty.participants.includes(defender) &&
    !treaty.participants.includes(attacker)
  );
  
  defensiveAllies.forEach(treaty => {
    const ally = treaty.participants.find(team => team !== defender);
    if (!ally || ally === attacker || isAtWar(ally, attacker)) return;
    
    diplomacy.warDeclarations.push({
      target: attacker,
      attacker: ally,
      declaredTurn: turnNumber,
      canAttackTurn: turnNumber,
      active: true,
      reason: `Defensive pact with ${defender}`
    });
    
    modifyTrust(ally, defender, 8, `${ally} honored a defensive pact with ${defender}`);
    modifyTrust(ally, attacker, -35, `${ally} joined defensive war against ${attacker}`);
    
    if (ally === 'PLAYER') {
      showPopup('Defensive Pact Triggered', `Your pact with ${defender} pulled you into war with ${attacker}.`, 'warning');
    } else {
      addAIMessage(ally, `Our pact with ${defender} compels us to oppose ${attacker}.`, 'WAR_DECLARATION');
    }
    
    console.log(`${ally} joined war against ${attacker} due to defensive pact with ${defender}`);
  });
}

function applyTreatyTurnBenefits() {
  if (!diplomacy || !Array.isArray(diplomacy.treaties)) return;
  
  diplomacy.treaties.forEach(treaty => {
    if (!treaty.active) return;
    const [team1, team2] = treaty.participants;
    
    if (treaty.type === 'TRADE_AGREEMENT' && !isAtWar(team1, team2)) {
      addResources(team1, { gold: 1, materials: 1 });
      addResources(team2, { gold: 1, materials: 1 });
      modifyTrust(team1, team2, 1, 'Trade agreement generated prosperity');
      console.log(`Trade agreement generated +1 gold/+1 materials for ${team1} and ${team2}`);
    }
    
    if (treaty.type === 'DEFENSIVE_PACT' && !isAtWar(team1, team2) && turnNumber % 3 === 0) {
      modifyTrust(team1, team2, 2, 'Defensive pact cooperation');
    }
  });
}

function canAffordTreatyBreak(faction, treatyType) {
  const breakingCosts = {
    'NON_AGGRESSION': { gold: 3 },
    'DEFENSIVE_PACT': { gold: 10 },
    'TRADE_AGREEMENT': { gold: 0 } // Trade treaties cost nothing to break
  };
  
  const cost = breakingCosts[treatyType] || { gold: 0 };
  
  // Handle both old and new resource systems
  if (typeof resources[faction] === 'object') {
    // New two-resource system
    return hasResources(faction, cost);
  } else {
    // Old single resource system - treat as gold
    return (resources[faction] || 0) >= (cost.gold || 0);
  }
}

function breakTreaty(treaty, breakingFaction, reason = 'Treaty violation') {
  if (!treaty.active) return false;
  
  const otherFaction = treaty.participants.find(f => f !== breakingFaction);
  
  // Check if faction can afford to break the treaty
  if (!canAffordTreatyBreak(breakingFaction, treaty.type)) {
    if (breakingFaction === 'PLAYER') {
      const breakingCosts = {
        'NON_AGGRESSION': '3 gold',
        'DEFENSIVE_PACT': '10 gold',
        'TRADE_AGREEMENT': 'nothing'
      };
      showPopup('Cannot Break Treaty', `You cannot afford to break this treaty! Breaking a ${TREATY_TYPES[treaty.type].name} costs ${breakingCosts[treaty.type] || '0'}.`, 'error');
    }
    return false;
  }
  
  // Apply resource costs
  const breakingCosts = {
    'NON_AGGRESSION': { gold: 3 },
    'DEFENSIVE_PACT': { gold: 10 },
    'TRADE_AGREEMENT': { gold: 0 }
  };
  
  const cost = breakingCosts[treaty.type] || { gold: 0 };
  
  // Handle both old and new resource systems
  if (typeof resources[breakingFaction] === 'object') {
    // New two-resource system
    if (!spendResources(breakingFaction, cost)) return false;
    // Pay the other faction
    addResources(otherFaction, cost);
  } else {
    // Old single resource system
    const goldCost = cost.gold || 0;
    if (goldCost > 0) {
      resources[breakingFaction] -= goldCost;
      resources[otherFaction] += goldCost;
    }
  }
  
  treaty.active = false;
  
  // Apply breaking penalties
  const penalty = TREATY_TYPES[treaty.type].breakPenalty;
  modifyTrust(breakingFaction, otherFaction, penalty, reason);
  modifyReputation(breakingFaction, penalty / 2, `Broke treaty with ${otherFaction}`);
  
  if (cost.gold > 0) {
    console.log(`${breakingFaction} broke ${TREATY_TYPES[treaty.type].name} with ${otherFaction} (paid ${cost.gold} gold): ${reason}`);
  } else {
    console.log(`${breakingFaction} broke ${TREATY_TYPES[treaty.type].name} with ${otherFaction}: ${reason}`);
  }
  
  return true;
}

function hasTreaty(faction1, faction2, treatyType = null) {
  return diplomacy.treaties.some(treaty => 
    treaty.active &&
    treaty.participants.includes(faction1) &&
    treaty.participants.includes(faction2) &&
    (treatyType === null || treaty.type === treatyType)
  );
}

// Trade Proposal System
function processTradeProposals(aiTeam) {
  // Process incoming trade proposals for this AI
  const incomingProposals = tradeProposals.filter(p => 
    p.target === aiTeam && p.status === 'PENDING' && turnNumber <= p.expiresOn
  );
  
  incomingProposals.forEach(proposal => {
    if (evaluateTradeProposal(aiTeam, proposal)) {
      acceptTradeProposal(proposal.id, aiTeam);
    } else {
      rejectTradeProposal(proposal.id, aiTeam);
    }
  });
}

function cleanupExpiredTradeProposals() {
  const expiredProposals = tradeProposals.filter(p => 
    p.status === 'PENDING' && turnNumber > p.expiresOn
  );
  
  expiredProposals.forEach(proposal => {
    proposal.status = 'EXPIRED';
    addAIMessage(proposal.proposer, `Your trade proposal to ${proposal.target} has expired.`, 'TRADE_RESPONSE');
  });
}

// War Declaration System
function declareWar(attacker, target) {
  // Check if war already declared
  const existingWar = diplomacy.warDeclarations.find(w => 
    w.active &&
    ((w.attacker === attacker && w.target === target) ||
     (w.attacker === target && w.target === attacker))
  );
  if (existingWar) return false;

  // Break any existing treaties
  const existingTreaties = diplomacy.treaties.filter(treaty => 
    treaty.active && treaty.participants.includes(attacker) && treaty.participants.includes(target)
  );
  existingTreaties.forEach(treaty => {
    const broken = breakTreaty(treaty, attacker, 'Declaration of War');
    if (!broken) {
      console.log(`${attacker} cannot declare war on ${target} because ${TREATY_TYPES[treaty.type].name} could not be broken`);
    }
  });
  if (existingTreaties.some(treaty => treaty.active)) return false;

  // Create war declaration
  const warDeclaration = {
    target,
    attacker,
    declaredTurn: turnNumber,
    canAttackTurn: turnNumber,
    active: true
  };
  
  diplomacy.warDeclarations.push(warDeclaration);
  
  // Massive trust penalty
  modifyTrust(attacker, target, -50, `${attacker} declared war on ${target}`);
  modifyTrust(target, attacker, -50, `${attacker} declared war on ${target}`);
  
  // Reputation penalty for aggression
  modifyReputation(attacker, -10, `Declared war on ${target}`);
  
  // Add AI message about war declaration with dynamic responses
  if (target === 'PLAYER') {
    const attackerPersonality = diplomacy.personalities[attacker] || 'BALANCED';
    const dynamicMessage = generateDynamicResponse('WAR_DECLARATION', attackerPersonality, { target: 'PLAYER' });
    addAIMessage(attacker, dynamicMessage, 'WAR_DECLARATION');
  } else if (attacker === 'PLAYER') {
    const defenderPersonality = diplomacy.personalities[target] || 'BALANCED';
    const dynamicMessage = generateDynamicResponse('WAR_RESPONSE', defenderPersonality, { attacker: 'PLAYER' });
    addAIMessage(target, dynamicMessage, 'WAR_RESPONSE');
  }
  
  applyDefensivePactResponses(target, attacker);
  
  console.log(`${attacker} declared war on ${target} (can attack from turn ${warDeclaration.canAttackTurn})`);
  return true;
}

function canAttack(attacker, target) {
  if(attacker===target || areFriendlyTeams(attacker,target))return false;
  // If diplomacy system is not initialized for these factions, allow legacy free combat.
  if (!isDiplomacyActive() || !diplomacy.warDeclarations || !diplomacy.trust[attacker] || diplomacy.trust[attacker][target] === undefined) {
    return true;
  }
  
  // Check if there's an active war declaration between these factions (either direction)
  const warDeclaration = diplomacy.warDeclarations.find(w => 
    w.active && 
    ((w.attacker === attacker && w.target === target) || 
     (w.attacker === target && w.target === attacker))
  );
  
  if (!warDeclaration) return false;
  return turnNumber >= warDeclaration.canAttackTurn;
}

function areFriendlyTeams(a,b) {
  return !!a && !!b && (a===b || (!isAtWar(a,b) && (hasTreaty(a,b,'DEFENSIVE_PACT') || hasTreaty(a,b,'NON_AGGRESSION'))));
}

function isAtWar(faction1, faction2) {
  return diplomacy.warDeclarations.some(w => 
    w.active && 
    ((w.attacker === faction1 && w.target === faction2) || 
     (w.attacker === faction2 && w.target === faction1))
  );
}

function addAIMessage(fromFaction, message, type = 'GENERAL') {
  // Add a small delay to ensure proper message ordering
  const baseTime = Date.now();
  const delayOffset = diplomacy.aiMessages.length; // Ensures chronological order
  
  const aiMessage = {
    from: fromFaction,
    message: message,
    type: type,
    turn: turnNumber,
    timestamp: baseTime + delayOffset,
    read: false
  };
  
  diplomacy.aiMessages.push(aiMessage);
  diplomacy.unreadMessages++;
  updateNotificationBubble();
  updateDiplomacyButtonBubbles(); // Update individual faction button bubbles
  
  console.log(`AI Message from ${fromFaction}: ${message}`);
}

// Dynamic AI Response Generator - Creates unique responses every time
const AI_RESPONSE_COMPONENTS = {
  // War declarations
  warDeclarationIntros: [
    "We declare war upon", "Your realm faces the wrath of", "The time for peace has ended -", 
    "Your transgressions have forced us to", "We can no longer tolerate", "By decree of our council, we",
    "The fires of war now burn between", "Your actions have sealed your fate -", "Our armies march against"
  ],
  warDeclarationTargets: [
    "your pathetic realm", "your crumbling domain", "your weakened territories", "your misguided nation",
    "your treacherous lands", "your foolish kingdom", "your corrupt empire", "your doomed civilization"
  ],
  warDeclarationEndings: [
    "Prepare for battle!", "Steel shall decide our fate!", "May the strongest prevail!",
    "Your downfall is assured!", "Victory will be ours!", "Surrender now or face annihilation!",
    "The battlefield awaits!", "Let blood settle our differences!", "Prepare to meet your doom!"
  ],
  
  // War responses (when someone declares on AI)
  warResponseIntros: [
    "Your declaration of war", "This act of aggression", "Your foolish challenge", "This declaration",
    "Your hostile move", "This act of war", "Your reckless decision", "This provocation"
  ],
  warResponseMidparts: [
    "will not go unanswered", "seals your fate", "has consequences", "demands retribution",
    "will be met with force", "brings doom upon you", "ensures your destruction", "guarantees conflict"
  ],
  warResponseEndings: [
    "You have chosen poorly!", "Prepare to face our might!", "Your armies will be scattered!",
    "We accept your challenge!", "So be it - let war begin!", "You will regret this decision!",
    "Our response will be swift!", "The die is cast!", "May the gods have mercy on you!"
  ],
  
  // Threat responses
  threatIntros: [
    "Your threats", "Such insolence", "Your arrogance", "These hollow words", "Your intimidation attempts",
    "Such boldness", "Your aggressive posturing", "These empty threats", "Your provocative words"
  ],
  threatMidparts: [
    "amuse us greatly", "fall on deaf ears", "only strengthen our resolve", "reveal your weakness",
    "will be your undoing", "show your desperation", "betray your fears", "expose your cowardice"
  ],
  threatEndings: [
    "Try us if you dare!", "We fear nothing from you!", "Your bark is worse than your bite!",
    "Actions speak louder than words!", "We remain unimpressed!", "Do your worst!",
    "We await your next move!", "Your bluffs won't work here!", "Prove your mettle!"
  ],
  
  // Peace responses
  peaceIntros: [
    "Your offer of peace", "This diplomatic overture", "Your peaceful gesture", "This proposal",
    "Your desire for harmony", "This olive branch", "Your diplomatic approach", "This peaceful initiative"
  ],
  peaceMidparts: [
    "is noted with interest", "deserves consideration", "has merit", "shows wisdom",
    "reflects good judgment", "demonstrates maturity", "suggests enlightenment", "indicates progress"
  ],
  peaceEndings: [
    "Let us discuss terms.", "Perhaps accommodation is possible.", "We are willing to negotiate.",
    "Mutual benefit should guide us.", "Cooperation serves us both.", "Let diplomacy prevail.",
    "Peace profits all parties.", "Wisdom over warfare.", "Let reason rule."
  ],
  
  // Generic adjectives for variety
  adjectives: [
    "foolish", "reckless", "arrogant", "pathetic", "misguided", "treacherous", "corrupt", "weak",
    "bold", "daring", "calculating", "shrewd", "diplomatic", "reasonable", "measured", "thoughtful"
  ],
  
  // Personality-specific modifiers
  aggressiveModifiers: ["with steel and fire", "through blood and conquest", "with unstoppable force", "by sword and spear"],
  defensiveModifiers: ["to protect our people", "in defense of our realm", "to preserve our way of life", "for the safety of all"],
  traderModifiers: ["for mutual profit", "with fair terms", "through honest dealing", "with profitable outcomes"],
  ideologicalModifiers: ["for the greater good", "in service of our cause", "by divine mandate", "for righteous purposes"],
  balancedModifiers: ["with measured response", "through careful consideration", "with diplomatic wisdom", "in pursuit of balance"]
};

function generateDynamicResponse(messageType, personality, context = {}) {
  const components = AI_RESPONSE_COMPONENTS;
  const personalityData = AI_PERSONALITIES[personality] || AI_PERSONALITIES.BALANCED;
  
  let response = "";
  
  switch(messageType) {
    case 'WAR_DECLARATION':
      const intro = components.warDeclarationIntros[Math.floor(Math.random() * components.warDeclarationIntros.length)];
      const target = components.warDeclarationTargets[Math.floor(Math.random() * components.warDeclarationTargets.length)];
      const ending = components.warDeclarationEndings[Math.floor(Math.random() * components.warDeclarationEndings.length)];
      response = `${intro} ${target}! ${ending}`;
      break;
      
    case 'WAR_RESPONSE':
      const respIntro = components.warResponseIntros[Math.floor(Math.random() * components.warResponseIntros.length)];
      const respMid = components.warResponseMidparts[Math.floor(Math.random() * components.warResponseMidparts.length)];
      const respEnd = components.warResponseEndings[Math.floor(Math.random() * components.warResponseEndings.length)];
      response = `${respIntro} ${respMid}! ${respEnd}`;
      break;
      
    case 'THREAT_RESPONSE':
      const threatIntro = components.threatIntros[Math.floor(Math.random() * components.threatIntros.length)];
      const threatMid = components.threatMidparts[Math.floor(Math.random() * components.threatMidparts.length)];
      const threatEnd = components.threatEndings[Math.floor(Math.random() * components.threatEndings.length)];
      response = `${threatIntro} ${threatMid}. ${threatEnd}`;
      break;
      
    case 'PEACE_RESPONSE':
      const peaceIntro = components.peaceIntros[Math.floor(Math.random() * components.peaceIntros.length)];
      const peaceMid = components.peaceMidparts[Math.floor(Math.random() * components.peaceMidparts.length)];
      const peaceEnd = components.peaceEndings[Math.floor(Math.random() * components.peaceEndings.length)];
      response = `${peaceIntro} ${peaceMid}. ${peaceEnd}`;
      break;
      
    default:
      // Use existing personality responses as fallback
      const responses = personalityData.neutralResponses || ["Your message is acknowledged."];
      response = responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Add personality-specific modifier occasionally
  if (Math.random() < 0.3) {
    const modifierKey = personality.toLowerCase() + 'Modifiers';
    const modifiers = components[modifierKey];
    if (modifiers) {
      const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
      response += ` We act ${modifier}.`;
    }
  }
  
  return response;
}

function evaluateDiplomaticAction(actingFaction, targetFaction, actionType) {
  const trust = getTrust(actingFaction, targetFaction);
  const reputation = getReputation(actingFaction);
  const personality = diplomacy.personalities[actingFaction];
  
  if (!personality) return Math.random() > 0.5; // Default random behavior for human players
  
  const archetype = AI_PERSONALITIES[personality];
  let baseChance = 0.5;
  
  // Calculate power ratios for power-based diplomacy
  const actingPower = calculateFactionPower(actingFaction);
  const targetPower = calculateFactionPower(targetFaction);
  const powerRatio = actingPower / Math.max(targetPower, 1);
  const isWeaker = powerRatio < 0.7;
  const isStronger = powerRatio > 1.4;
  const isSignificantlyWeaker = powerRatio < 0.5;
  const isSignificantlyStronger = powerRatio > 2.0;
  
  switch (actionType) {
    case 'ATTACK':
      baseChance = archetype.warlikeness;
      // Much more restrictive attacking when treaties exist
      if (hasTreaty(actingFaction, targetFaction, 'NON_AGGRESSION')) baseChance *= 0.05; // Reduced from 0.3 to 0.05
      if (hasTreaty(actingFaction, targetFaction, 'TRADE_AGREEMENT')) baseChance *= 0.1; // Also respect trade agreements
      if (trust > 30) baseChance *= 0.2; // Reduced from 50 to 30, and penalty from 0.4 to 0.2
      if (trust > 50) baseChance *= 0.05; // Additional severe penalty for high trust
      break;
      
    case 'PROPOSE_TREATY':
      baseChance = 0.7 - archetype.warlikeness * 0.5;
      if (trust > 20) baseChance += 0.2;
      if (reputation > 30) baseChance += 0.15;
      
      // POWER-BASED TREATY MODIFICATIONS
      if (isSignificantlyWeaker) {
        // Weaker factions are more eager to make treaties
        baseChance += 0.4;
        if (targetFaction === 'PLAYER') baseChance += 0.2; // Extra eager with player
      } else if (isSignificantlyStronger) {
        // Stronger factions are less interested in treaties
        baseChance -= 0.5;
        if (targetFaction === 'PLAYER') baseChance -= 0.3; // Especially dismissive of player
      } else if (isWeaker) {
        baseChance += 0.2; // Moderately weaker seeks security
      } else if (isStronger) {
        baseChance -= 0.2; // Moderately stronger is less interested
      }
      break;
      
    case 'BREAK_TREATY':
      baseChance = archetype.treatyBreakChance;
      // Much more restrictive treaty breaking
      if (trust > 20) baseChance *= 0.1;  // Reduced from 40 to 20, and penalty from 0.5 to 0.1
      if (trust > 40) baseChance *= 0.05; // Additional severe penalty for high trust
      if (reputation > 30) baseChance *= 0.1; // Reduced from 50 to 30, and penalty from 0.3 to 0.1
      break;
  }
  
  return Math.random() < Math.max(0.05, Math.min(0.95, baseChance));
}

/**
 * Handle AI-initiated diplomatic messages based on power dynamics
 */
function processAIPowerBasedDiplomacy(aiTeam) {
  const personality = diplomacy.personalities[aiTeam] ? AI_PERSONALITIES[diplomacy.personalities[aiTeam]] : AI_PERSONALITIES.BALANCED;
  const playerPower = calculateFactionPower('PLAYER');
  const aiPower = calculateFactionPower(aiTeam);
  const powerRatio = aiPower / Math.max(playerPower, 1);
  const trust = getTrust(aiTeam, 'PLAYER');
  
  // Skip if recently sent a message (prevent spam)
  if (diplomacy.messageHistory && diplomacy.messageHistory.length > 0) {
    const recentMessages = diplomacy.messageHistory.filter(msg => 
      msg.sender === aiTeam && 
      msg.recipient === 'PLAYER' && 
      Date.now() - msg.timestamp < 30000 // 30 seconds
    );
    if (recentMessages.length > 0) return;
  }
  
  // WEAKER AI BEHAVIORS
  if (powerRatio < 0.5) {
    // Significantly weaker - send compliments and peace offers
    if (Math.random() < 0.15) { // 15% chance per turn
      const compliments = [
        `Your military prowess is truly impressive, ${personality.name === 'Unknown' ? 'leader' : 'great one'}.`,
        "I must admire your strategic brilliance. Perhaps we could discuss mutual cooperation?",
        "Your forces inspire both fear and respect. Would you consider a more... friendly relationship?",
        "Your expansion has been masterful. I hope we can find common ground for peace."
      ];
      addAIMessage(aiTeam, compliments[Math.floor(Math.random() * compliments.length)], 'COMPLIMENT');
    }
    
    // If at war and losing badly, beg for peace
    if (isAtWar(aiTeam, 'PLAYER') && Math.random() < 0.25) { // 25% chance when at war
      const peaceRequests = [
        "Enough blood has been spilled! I propose we end this conflict with a peace treaty.",
        "Your victory is assured - but mercy would be the mark of a truly great leader. Let us make peace.",
        "I have learned my lesson. Please, let us negotiate an end to this war.",
        "Continued fighting serves neither of us. I offer a peace treaty and promise to honor it."
      ];
      addAIMessage(aiTeam, peaceRequests[Math.floor(Math.random() * peaceRequests.length)], 'PEACE_REQUEST');
      
      // Mark that this AI has begged for peace (makes them more likely to accept peace offers)
      if (!diplomacy.peaceBeggingFlags) diplomacy.peaceBeggingFlags = {};
      diplomacy.peaceBeggingFlags[aiTeam] = turnNumber + 5; // Flag lasts for 5 turns
      
      // Send a follow-up message suggesting the player offer peace
      if (Math.random() < 0.6) { // 60% chance to follow through
        setTimeout(() => {
          if (isAtWar(aiTeam, 'PLAYER')) {
            addAIMessage(aiTeam, "I am ready to discuss peace terms. Please use the diplomacy menu to offer a non-aggression pact.", 'TREATY_OFFER');
          }
        }, 2000);
      }
    }
  } 
  // MODERATELY WEAKER AI - more agreeable
  else if (powerRatio < 0.7) {
    if (Math.random() < 0.08) { // 8% chance per turn
      const friendlyMessages = [
        "Greetings, neighbor. Your strength grows impressive - perhaps we should be allies rather than rivals?",
        "I respect your growing power. Would you be interested in a mutually beneficial agreement?",
        "Your faction's progress has not gone unnoticed. I believe cooperation would serve us both."
      ];
      addAIMessage(aiTeam, friendlyMessages[Math.floor(Math.random() * friendlyMessages.length)], 'ALLIANCE_OFFER');
      
      // Offer alliance (but don't create it automatically)
      if (Math.random() < 0.4 && !hasTreaty(aiTeam, 'PLAYER', 'DEFENSIVE_PACT')) {
        setTimeout(() => {
          addAIMessage(aiTeam, "I believe our civilizations would benefit from a formal alliance. Please consider proposing a defensive pact through the diplomacy menu.", 'TREATY_OFFER');
        }, 1500);
      }
    }
  }
  // SIGNIFICANTLY STRONGER AI - dismissive and threatening
  else if (powerRatio > 2.0) {
    if (Math.random() < 0.12) { // 12% chance per turn
      const dominantMessages = [
        "You amuse me with your feeble attempts at diplomacy. I need no allies to crush you and the rest of this world.",
        "Treaties? I have no need for such things when my armies are superior to all others combined.",
        "Your weakness is apparent to all. I shall conquer as I see fit, with or without your cooperation.",
        "Why would I treat with ants? My power is absolute - your submission would be more appropriate."
      ];
      addAIMessage(aiTeam, dominantMessages[Math.floor(Math.random() * dominantMessages.length)], 'DOMINANCE_DISPLAY');
      
      // Reject any existing treaty offers from player
      const existingTreaties = diplomacy.treaties.filter(t => 
        t.active && t.participants.includes(aiTeam) && t.participants.includes('PLAYER')
      );
      existingTreaties.forEach(treaty => {
        if (Math.random() < 0.3) { // 30% chance to break existing treaties
          breakTreaty(treaty, aiTeam, 'Your weakness makes this treaty meaningless');
        }
      });
      
      // AGGRESSIVE WAR DECLARATION: Declare war on weak enemies with low trust
      if (!isAtWar(aiTeam, 'PLAYER') && trust <= 0 && Math.random() < 0.25) {
        console.log(`${aiTeam} is declaring war on PLAYER due to power advantage (${powerRatio.toFixed(2)}x stronger, trust: ${trust})`);
        declareWar(aiTeam, 'PLAYER');
        const warMessages = [
          "Your pathetic civilization is an insult to this world. I declare war upon you!",
          "The time for diplomacy has ended. My armies shall crush your weak nation!",
          "You have shown nothing but weakness. War is the only language you will understand!",
          "I grow tired of your existence. Prepare for total annihilation!"
        ];
        addAIMessage(aiTeam, warMessages[Math.floor(Math.random() * warMessages.length)], 'WAR_DECLARATION');
      }
    }
  }
  
  // AGGRESSIVE AI vs AI WARFARE: Check all other AI teams for war opportunities
  const allAITeams = getActiveTeams().filter(team => isAITeam(team) && team !== aiTeam);
  for (const enemyTeam of allAITeams) {
    const enemyPower = calculateFactionPower(enemyTeam);
    const enemyRatio = aiPower / Math.max(enemyPower, 1);
    const aiToEnemyTrust = getTrust(aiTeam, enemyTeam);
    
    // Declare war if significantly stronger and trust is not positive
    if (enemyRatio >= 2.0 && aiToEnemyTrust <= 0 && !isAtWar(aiTeam, enemyTeam) && Math.random() < 0.15) {
      console.log(`${aiTeam} is declaring war on ${enemyTeam} due to power advantage (${enemyRatio.toFixed(2)}x stronger, trust: ${aiToEnemyTrust})`);
      declareWar(aiTeam, enemyTeam);
      const warMessages = [
        `The weakness of ${enemyTeam} is an opportunity I cannot ignore. War is declared!`,
        `${enemyTeam} has grown too comfortable in their weakness. Time for conquest!`,
        `I shall expand my domain by crushing the pathetic forces of ${enemyTeam}!`
      ];
      addAIMessage(aiTeam, warMessages[Math.floor(Math.random() * warMessages.length)], 'WAR_DECLARATION');
    }
  }
}

function updateDiplomacyUI() {
  const trustMatrix = select('#trustMatrix');
  const reputationList = select('#reputationList');
  const treatyList = select('#treatyList');
  
  if (!trustMatrix) return;
  if (!diplomacy.trust) ensureDiplomacyForActiveTeams();
  
  const allTeams = getActiveTeams();
  ensureDiplomacyForActiveTeams();
  renderStartingDiplomacyEditor();
  const playerTeam = 'PLAYER';
  
  // Update trust matrix - focus on player relationships first
  let trustHTML = '<div style="color: var(--accent); font-weight: bold; margin-bottom: 8px;">Your Relations:</div>';
  
  // Show player's relationships with everyone else
  allTeams.forEach(otherTeam => {
    if (otherTeam !== playerTeam) {
      const trust = getTrust(playerTeam, otherTeam);
      const theirTrust = getTrust(otherTeam, playerTeam);
      const avgTrust = (trust + theirTrust) / 2;
      
      let color, relationship, icon;
      if (avgTrust > 40) {
        color = '#4ecdc4'; relationship = 'Allied'; icon = '🤝';
      } else if (avgTrust > 20) {
        color = '#7ed321'; relationship = 'Friendly'; icon = '😊';
      } else if (avgTrust > -20) {
        color = '#ffd166'; relationship = 'Neutral'; icon = '😐';
      } else if (avgTrust > -40) {
        color = '#ff9500'; relationship = 'Hostile'; icon = '😠';
      } else {
        color = '#ff6b6b'; relationship = 'Enemy'; icon = '⚔️';
      }
      
      const personality = diplomacy.personalities[otherTeam] ? AI_PERSONALITIES[diplomacy.personalities[otherTeam]].name : 'Human';
      const hasNAP = hasTreaty(playerTeam, otherTeam, 'NON_AGGRESSION') ? ' 🕊️' : '';
      const hasTrade = hasTreaty(playerTeam, otherTeam, 'TRADE_AGREEMENT') ? ' 💰' : '';
      const hasDefense = hasTreaty(playerTeam, otherTeam, 'DEFENSIVE_PACT') ? ' 🛡️' : '';
      
      trustHTML += `<div style="display: flex; align-items: center; margin: 4px 0; padding: 4px; background: rgba(255,255,255,0.05); border-radius: 4px;">
        <span style="margin-right: 8px;">${icon}</span>
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: ${getTeamColorHex(otherTeam)}; font-weight: bold;">${otherTeam}</span>
            <span style="color: ${color}; font-weight: bold;">${relationship}</span>
          </div>
          <div style="font-size: 10px; color: var(--muted);">
            ${personality} • Trust: ${avgTrust.toFixed(0)}${hasNAP}${hasTrade}${hasDefense}
          </div>
        </div>
      </div>`;
    }
  });
  
  // Show other AI relationships (collapsed view)
  if (allTeams.length > 3) {
    trustHTML += '<div style="color: var(--muted); font-weight: bold; margin: 12px 0 4px 0; font-size: 11px;">AI Relations:</div>';
    allTeams.forEach(team1 => {
      if (team1 !== playerTeam && isAITeam(team1)) {
        allTeams.forEach(team2 => {
          if (team2 !== playerTeam && team2 !== team1 && isAITeam(team2)) {
            const trust = getTrust(team1, team2);
            const color = trust > 20 ? '#4ecdc4' : trust < -20 ? '#ff6b6b' : '#ffd166';
            const relationship = trust > 40 ? 'Allied' : trust > 20 ? 'Friendly' : trust > -20 ? 'Neutral' : 'Hostile';
            
            trustHTML += `<div style="display: flex; justify-content: space-between; margin: 1px 0; font-size: 10px;">
              <span style="color: ${getTeamColorHex(team1)};">${team1}</span>
              <span style="color: ${getTeamColorHex(team2)};">→${team2}</span>
              <span style="color: ${color};">${relationship}</span>
            </div>`;
          }
        });
      }
    });
  }
  
  trustMatrix.html(trustHTML);
  
  // Update reputation list - focus on what others think of the player
  let repHTML = '<div style="color: var(--accent); font-weight: bold; margin-bottom: 4px;">Your Reputation:</div>';
  allTeams.forEach(team => {
    if (team !== 'PLAYER') {
      const rep = getReputation('PLAYER', team); // How this team views the player
      const color = rep > 20 ? '#4ecdc4' : rep < -20 ? '#ff6b6b' : '#ffd166';
      const personality = diplomacy.personalities[team] ? AI_PERSONALITIES[diplomacy.personalities[team]].name : 'Unknown';
      
      let repDesc = 'Neutral';
      if (rep > 40) repDesc = 'Highly Respected';
      else if (rep > 20) repDesc = 'Respected';
      else if (rep < -40) repDesc = 'Despised';
      else if (rep < -20) repDesc = 'Disliked';
      
      repHTML += `<div style="display: flex; justify-content: space-between; margin: 2px 0; font-size: 11px;">
        <span style="color: ${getTeamColorHex(team)};">${team}</span>
        <span style="color: ${color};">${repDesc} (${rep.toFixed(0)})</span>
      </div>`;
    }
  });
  reputationList.html(repHTML);
  
  // Update active treaties - show player treaties prominently
  let treatyHTML = '<div style="color: var(--accent); font-weight: bold; margin-bottom: 4px;">Active Treaties:</div>';
  const activeTreaties = diplomacy.treaties.filter(t => t.active);
  let playerTreaties = [];
  let otherTreaties = [];
  
  activeTreaties.forEach(treaty => {
    const [team1, team2] = treaty.participants;
    if (team1 === 'PLAYER' || team2 === 'PLAYER') {
      playerTreaties.push(treaty);
    } else {
      otherTreaties.push(treaty);
    }
  });
  
  // Show player treaties first
  playerTreaties.forEach(treaty => {
    const [team1, team2] = treaty.participants;
    const otherTeam = team1 === 'PLAYER' ? team2 : team1;
    const treatyType = TREATY_TYPES[treaty.type];
    const icon = treaty.type === 'NON_AGGRESSION' ? '🕊️' : treaty.type === 'TRADE_AGREEMENT' ? '💰' : '🛡️';
    
    treatyHTML += `<div style="display: flex; align-items: center; margin: 3px 0; padding: 2px; background: rgba(255,255,255,0.05); border-radius: 3px;">
      <span style="margin-right: 6px;">${icon}</span>
      <div style="flex: 1;">
        <span style="color: ${getTeamColorHex(otherTeam)}; font-weight: bold;">${otherTeam}</span>
        <div style="font-size: 10px; color: var(--accent);">${treatyType.name} (${treaty.turnsRemaining} turns)</div>
      </div>
    </div>`;
  });
  
  // Show other AI treaties in smaller text
  if (otherTreaties.length > 0) {
    treatyHTML += '<div style="color: var(--muted); font-size: 10px; margin-top: 8px;">Other Treaties:</div>';
    otherTreaties.forEach(treaty => {
      const [team1, team2] = treaty.participants;
      const treatyType = TREATY_TYPES[treaty.type];
      treatyHTML += `<div style="font-size: 10px; color: var(--muted); margin: 1px 0;">
        <span style="color: ${getTeamColorHex(team1)};">${team1}</span> ↔ 
        <span style="color: ${getTeamColorHex(team2)};">${team2}</span>: ${treatyType.name}
      </div>`;
    });
  }
  
  if (playerTreaties.length === 0 && otherTreaties.length === 0) {
    treatyHTML += '<span style="color: var(--muted); font-size: 11px;">No active treaties</span>';
  }
  
  treatyList.html(treatyHTML);
  
  // Show/hide diplomacy button based on whether there are AI players
  const mapDiplomacyButton = document.getElementById('mapDiplomacyButton');
  const hasAIPlayers = allTeams.some(team => team !== 'PLAYER' && team !== 'PLAYER2' && isAITeam(team));
  
  if (mapDiplomacyButton) {
    if (hasAIPlayers) {
      mapDiplomacyButton.style.display = 'block';
      updateNotificationBubble();
    } else {
      mapDiplomacyButton.style.display = 'none';
    }
  }
}

function updateNotificationBubble() {
  const bubble = document.getElementById('notificationBubble');
  if (bubble && diplomacy) {
    const count = diplomacy.unreadMessages || 0;
    if (count > 0) {
      bubble.style.display = 'flex';
      bubble.textContent = count > 9 ? '9+' : count.toString();
    } else {
      bubble.style.display = 'none';
    }
  }
}

// ---------- Diplomacy Negotiation System ----------
let currentDiplomacyTarget = null;
let messageHistory = {};
let recentMessageTypes = {}; // Track recent message types to prevent spam
let communicationLockouts = {}; // Track factions that refuse to talk

function ensureDiplomacyModal() {
  let modal = document.getElementById('diplomacyModal');
  if (modal) return modal;
  
  modal = document.createElement('div');
  modal.id = 'diplomacyModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);display:none;align-items:center;justify-content:center;z-index:20000;padding:16px;';
  modal.onclick = event => {
    if (event.target === modal) closeDiplomacyNegotiation();
  };
  
  modal.innerHTML = `
    <div style="background:var(--panel);color:var(--muted);border:1px solid rgba(255,255,255,0.12);border-radius:8px;width:min(920px,96vw);max-height:90vh;overflow:hidden;display:grid;grid-template-columns:240px 1fr;">
      <div style="padding:14px;border-right:1px solid rgba(255,255,255,0.1);overflow:auto;max-height:90vh;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
          <h3 style="margin:0;color:var(--accent);font-size:16px;">Diplomacy</h3>
          <button onclick="closeDiplomacyNegotiation()" class="small" style="padding:4px 8px;">Close</button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">Choose a faction</div>
        <div id="diplomacyTargetButtons" style="display:flex;flex-direction:column;gap:8px;"></div>
        <button onclick="markAllMessagesRead()" class="small" style="width:100%;margin-top:12px;">Mark Read</button>
      </div>
      <div style="padding:14px;display:grid;grid-template-rows:auto minmax(180px,1fr) auto;gap:10px;max-height:90vh;">
        <div id="diplomacyTargetInfo" style="display:none;background:rgba(255,255,255,0.06);border-radius:8px;padding:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div id="targetFactionIcon" style="font-size:24px;">AI</div>
            <div style="flex:1;">
              <div id="targetFactionName" style="font-weight:bold;color:var(--accent);"></div>
              <div id="targetFactionPersonality" style="font-size:11px;color:var(--muted);"></div>
            </div>
            <div style="font-size:11px;text-align:right;">
              <div>Trust: <span id="targetTrust">0</span></div>
              <div>Reputation: <span id="targetReputation">0</span></div>
              <div>Treaties: <span id="targetTreaties">None</span></div>
            </div>
          </div>
        </div>
        <div id="messageHistory" style="overflow:auto;background:rgba(0,0,0,0.22);border-radius:8px;padding:12px;font-size:12px;"></div>
        <div>
          <div id="spamWarning" style="display:none;margin-bottom:8px;font-size:11px;"></div>
          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px;">
            <button onclick="sendQuickMessage('greeting')" class="small">Greet</button>
            <button onclick="sendQuickMessage('compliment')" class="small">Compliment</button>
            <button onclick="sendQuickMessage('warning')" class="small">Warn</button>
            <button onclick="sendQuickMessage('threat')" class="small">Threaten</button>
            <button onclick="sendQuickMessage('request_alliance')" class="small">Seek Alliance</button>
            <button onclick="sendQuickMessage('offer_trade')" class="small">Discuss Trade</button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <select id="treatyTypeSelect" style="padding:6px;border-radius:6px;background:#2a3440;color:#ddd;border:1px solid #555;">
              <option value="">Treaty...</option>
              <option value="NON_AGGRESSION">Non-Aggression Pact</option>
              <option value="TRADE_AGREEMENT">Trade Agreement</option>
              <option value="DEFENSIVE_PACT">Defensive Pact</option>
            </select>
            <button onclick="proposeTreaty()" class="small">Propose</button>
            <button onclick="openTradeProposalInterface()" class="small">Negotiate Trade</button>
            <button onclick="breakAllTreaties()" class="small">Break Treaties</button>
            <button onclick="declareWarOnTarget()" class="small" style="background:#9b2d2d;color:white;">Declare War</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  return modal;
}

function openDiplomacyNegotiation() {
  const modal = ensureDiplomacyModal();
  const targetButtons = document.getElementById('diplomacyTargetButtons');
  
  if (!modal || !targetButtons) {
    console.error('Diplomacy modal elements not found');
    return;
  }
  
  // Populate faction buttons with notification bubbles
  const activeTeams = getActiveTeams();
  let buttonsHTML = '';
  
  activeTeams.forEach(team => {
    if (team !== 'PLAYER' && isAITeam(team)) {
      // Ensure personality exists, if not assign one
      if (!diplomacy.personalities[team]) {
        const personalityTypes = Object.keys(AI_PERSONALITIES);
        const randomPersonality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];
        diplomacy.personalities[team] = randomPersonality;
        console.log(`Late assignment: ${team} assigned personality: ${AI_PERSONALITIES[randomPersonality].name}`);
      }
      
      const personalityData = AI_PERSONALITIES[diplomacy.personalities[team]];
      const personality = personalityData ? personalityData.name : 'Diplomat';
      const teamColor = getTeamColorHex(team);
      
      // Count unread messages from this specific team
      const unreadCount = getUnreadMessagesFromTeam(team);
      const notificationBubble = unreadCount > 0 ? 
        `<div style="position: absolute; top: -5px; right: -5px; background: #ff4757; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; z-index: 10;">${unreadCount}</div>` : '';
      
      buttonsHTML += `<button onclick="selectDiplomacyTarget('${team}')" style="padding: 8px 12px; background: ${teamColor}; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: transform 0.1s; position: relative;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${team}<br><span style="font-size: 9px; opacity: 0.8;">${personality}</span>${notificationBubble}</button>`;
    }
  });
  
  if (buttonsHTML === '') {
    buttonsHTML = '<div style="color: var(--muted); text-align: center; padding: 16px;">No AI factions available for diplomacy</div>';
  }
  
  targetButtons.innerHTML = buttonsHTML;
  modal.style.display = 'flex';
}

function closeDiplomacyNegotiation() {
  const modal = document.getElementById('diplomacyModal');
  if (modal) {
    modal.style.display = 'none';
  }
  currentDiplomacyTarget = null;
}

function getUnreadMessagesFromTeam(team) {
  if (!diplomacy.aiMessages) return 0;
  return diplomacy.aiMessages.filter(msg => msg.from === team && !msg.read).length;
}

function selectDiplomacyTarget(team) {
  currentDiplomacyTarget = team;
  
  // Mark messages from this team as read when selected
  if (diplomacy.aiMessages) {
    diplomacy.aiMessages.forEach(msg => {
      if (msg.from === team && !msg.read) {
        msg.read = true;
        diplomacy.unreadMessages = Math.max(0, diplomacy.unreadMessages - 1);
      }
    });
    updateNotificationBubble();
  }
  
  // Update button styling to show selected
  const buttons = document.querySelectorAll('#diplomacyTargetButtons button');
  buttons.forEach(btn => {
    btn.style.border = '2px solid transparent';
  });
  
  // Highlight selected button and update notification bubbles
  updateDiplomacyButtonBubbles();
  const selectedButton = Array.from(document.querySelectorAll('#diplomacyTargetButtons button')).find(btn => btn.onclick.toString().includes(`'${team}'`));
  if (selectedButton) {
    selectedButton.style.border = '2px solid var(--accent)';
  }
  
  updateDiplomacyTarget();
}

function updateDiplomacyButtonBubbles() {
  const targetButtons = document.getElementById('diplomacyTargetButtons');
  if (!targetButtons) return;
  
  // Only update if diplomacy modal is open
  const modal = document.getElementById('diplomacyModal');
  if (!modal || modal.style.display !== 'flex') return;
  
  const activeTeams = getActiveTeams();
  let buttonsHTML = '';
  
  activeTeams.forEach(team => {
    if (team !== 'PLAYER' && isAITeam(team)) {
      const personality = diplomacy.personalities[team] ? AI_PERSONALITIES[diplomacy.personalities[team]].name : 'Unknown';
      const teamColor = getTeamColorHex(team);
      const unreadCount = getUnreadMessagesFromTeam(team);
      const notificationBubble = unreadCount > 0 ? 
        `<div style="position: absolute; top: -5px; right: -5px; background: #ff4757; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; z-index: 10;">${unreadCount}</div>` : '';
      
      const isSelected = currentDiplomacyTarget === team;
      const border = isSelected ? '2px solid var(--accent)' : '2px solid transparent';
      
      buttonsHTML += `<button onclick="selectDiplomacyTarget('${team}')" style="padding: 8px 12px; background: ${teamColor}; color: white; border: ${border}; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: transform 0.1s; position: relative;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${team}<br><span style="font-size: 9px; opacity: 0.8;">${personality}</span>${notificationBubble}</button>`;
    }
  });
  
  if (buttonsHTML !== '') {
    targetButtons.innerHTML = buttonsHTML;
  }
}

function updateDiplomacyTarget() {
  const targetInfo = document.getElementById('diplomacyTargetInfo');
  const messageHistoryDiv = document.getElementById('messageHistory');
  
  console.log('updateDiplomacyTarget - selected:', currentDiplomacyTarget);
  
  if (!currentDiplomacyTarget) {
    if (targetInfo) targetInfo.style.display = 'none';
    if (messageHistoryDiv) messageHistoryDiv.innerHTML = '<div style="color: var(--muted); text-align: center; margin-top: 20px;">Select a faction to begin negotiations...</div>';
    return;
  }
  
  // Check if communication is locked
  const lockoutTurns = isLocked(currentDiplomacyTarget);
  if (lockoutTurns) {
    if (targetInfo) targetInfo.style.display = 'block';
    
    const targetFactionName = document.getElementById('targetFactionName');
    const targetFactionPersonality = document.getElementById('targetFactionPersonality');
    const targetTrust = document.getElementById('targetTrust');
    const targetReputation = document.getElementById('targetReputation');
    const targetTreaties = document.getElementById('targetTreaties');
    
    if (targetFactionName) {
      targetFactionName.innerHTML = currentDiplomacyTarget + ' (REFUSES TO TALK)';
      targetFactionName.style.color = '#ff6b6b';
    }
    if (targetFactionPersonality) targetFactionPersonality.innerHTML = `Communication locked for ${lockoutTurns} more turn(s)`;
    if (targetTrust) {
      targetTrust.innerHTML = 'N/A';
      targetTrust.style.color = '#ff6b6b';
    }
    if (targetReputation) {
      targetReputation.innerHTML = 'N/A';
      targetReputation.style.color = '#ff6b6b';
    }
    if (targetTreaties) targetTreaties.innerHTML = 'None available';
    
    if (messageHistoryDiv) messageHistoryDiv.innerHTML = '<div style="color: #ff6b6b; text-align: center; margin-top: 20px; font-weight: bold;">🚫 This faction refuses to speak with you due to excessive repetition.<br><br>Wait ' + lockoutTurns + ' more turn(s) before attempting communication.</div>';
    
    // Disable all message buttons
    const messageButtons = document.querySelectorAll('button[onclick*="sendQuickMessage"]');
    messageButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.3';
    });
    
    return;
  } else {
    // Re-enable message buttons if not locked
    const messageButtons = document.querySelectorAll('button[onclick*="sendQuickMessage"]');
    messageButtons.forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
    });
  }
  
  // Show target info
  if (targetInfo) targetInfo.style.display = 'block';
  
  const trust = getTrust('PLAYER', currentDiplomacyTarget);
  const theirTrust = getTrust(currentDiplomacyTarget, 'PLAYER');
  const avgTrust = (trust + theirTrust) / 2;
  const reputation = getReputation('PLAYER', currentDiplomacyTarget);
  const personality = diplomacy.personalities[currentDiplomacyTarget] ? AI_PERSONALITIES[diplomacy.personalities[currentDiplomacyTarget]] : null;
  
  // Update target info display
  const targetFactionIcon = document.getElementById('targetFactionIcon');
  const targetFactionName = document.getElementById('targetFactionName');
  const targetFactionPersonality = document.getElementById('targetFactionPersonality');
  const targetTrust = document.getElementById('targetTrust');
  const targetReputation = document.getElementById('targetReputation');
  const targetTreaties = document.getElementById('targetTreaties');
  
  if (targetFactionIcon) targetFactionIcon.innerHTML = getPersonalityIcon(personality?.type || 'BALANCED');
  if (targetFactionName) {
    targetFactionName.innerHTML = currentDiplomacyTarget;
    targetFactionName.style.color = getTeamColorHex(currentDiplomacyTarget);
  }
  if (targetFactionPersonality) targetFactionPersonality.innerHTML = personality ? personality.name + ' - ' + personality.description : 'Unknown AI';
  
  const trustColor = avgTrust > 20 ? '#4ecdc4' : avgTrust < -20 ? '#ff6b6b' : '#ffd166';
  const repColor = reputation > 20 ? '#4ecdc4' : reputation < -20 ? '#ff6b6b' : '#ffd166';
  
  if (targetTrust) {
    targetTrust.innerHTML = avgTrust.toFixed(0);
    targetTrust.style.color = trustColor;
  }
  if (targetReputation) {
    targetReputation.innerHTML = reputation.toFixed(0);
    targetReputation.style.color = repColor;
  }
  
  // Show active treaties
  const treaties = [];
  if (hasTreaty('PLAYER', currentDiplomacyTarget, 'NON_AGGRESSION')) treaties.push('🕊️ NAP');
  if (hasTreaty('PLAYER', currentDiplomacyTarget, 'TRADE_AGREEMENT')) treaties.push('💰 Trade');
  if (hasTreaty('PLAYER', currentDiplomacyTarget, 'DEFENSIVE_PACT')) treaties.push('🛡️ Defense');
  
  if (targetTreaties) targetTreaties.innerHTML = treaties.length > 0 ? treaties.join(', ') : 'None';
  
  // Load message history
  loadMessageHistory();
}

function getPersonalityIcon(personalityType) {
  switch (personalityType) {
    case 'AGGRESSIVE': return '⚔️';
    case 'DEFENSIVE': return '🛡️';
    case 'TRADER': return '💰';
    case 'IDEOLOGICAL': return '🏛️';
    case 'EXPANSIONIST': return '🌍';
    default: return '🤖';
  }
}

function loadMessageHistory() {
  if (!currentDiplomacyTarget) return;
  
  const messageHistoryDiv = document.getElementById('messageHistory');
  if (!messageHistoryDiv) {
    console.error('messageHistory element not found');
    return;
  }
  
  // Get personal messages between player and current target
  const personalHistory = messageHistory[currentDiplomacyTarget] || [];
  
  // Get AI messages from current target to player
  const aiMessages = diplomacy.aiMessages ? diplomacy.aiMessages.filter(msg => 
    msg.from === currentDiplomacyTarget || msg.to === currentDiplomacyTarget
  ) : [];
  
  // Combine and sort all messages by turn, then by timestamp for proper chronological order
  const allMessages = [...personalHistory, ...aiMessages].sort((a, b) => {
    // First sort by turn number
    if (a.turn !== b.turn) {
      return a.turn - b.turn;
    }
    // If same turn, sort by timestamp (or use current time if no timestamp)
    const aTime = a.timestamp || Date.now();
    const bTime = b.timestamp || Date.now();
    return aTime - bTime;
  });
  
  if (allMessages.length === 0) {
    messageHistoryDiv.innerHTML = '<div style="color: var(--muted); text-align: center; margin-top: 20px;">No previous messages. Start a conversation!</div>';
    return;
  }
  
  let historyHTML = '';
  allMessages.forEach(msg => {
    const isPlayer = msg.from === 'PLAYER';
    const isAIMessage = msg.type !== undefined; // AI messages have a type field
    const color = isPlayer ? '#4ecdc4' : getTeamColorHex(msg.from);
    const align = isPlayer ? 'right' : 'left';
    const bgColor = isPlayer ? 'rgba(78, 205, 196, 0.1)' : 
                    isAIMessage ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    const borderColor = isAIMessage && !msg.read ? '1px solid rgba(255, 215, 0, 0.3)' : 'none';
    const typeIcon = isAIMessage ? getMessageTypeIcon(msg.type) : '';
    const typeLabel = isAIMessage ? getMessageTypeLabel(msg.type) : '';
    
    historyHTML += `<div style="margin-bottom: 8px; text-align: ${align};">
      <div style="display: inline-block; max-width: 80%; padding: 6px 10px; background: ${bgColor}; border: ${borderColor}; border-radius: 12px; color: ${color};">
        <div style="font-weight: bold; font-size: 10px; margin-bottom: 2px;">
          ${isPlayer ? 'You' : msg.from} ${typeIcon}
        </div>
        ${isAIMessage ? `<div style="font-size: 9px; color: var(--accent); font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">${typeLabel}</div>` : ''}
        <div style="font-size: 11px;">${msg.message}</div>
        <div style="font-size: 9px; color: var(--muted); margin-top: 2px;">Turn ${msg.turn}</div>
      </div>
    </div>`;
  });
  
  messageHistoryDiv.innerHTML = historyHTML;
  // Scroll to bottom
  messageHistoryDiv.scrollTop = messageHistoryDiv.scrollHeight;
}



function checkMessageSpam(target, messageType) {
  // Initialize tracking for this target if needed
  if (!recentMessageTypes[target]) {
    recentMessageTypes[target] = {};
  }
  
  const targetHistory = recentMessageTypes[target];
  const currentTurn = turnNumber;
  
  // Clean up old messages (older than 5 turns)
  Object.keys(targetHistory).forEach(type => {
    targetHistory[type] = targetHistory[type].filter(turn => currentTurn - turn <= 5);
  });
  
  // Count recent messages of this type
  const recentCount = targetHistory[messageType] ? targetHistory[messageType].length : 0;
  
  // Record this message
  if (!targetHistory[messageType]) {
    targetHistory[messageType] = [];
  }
  targetHistory[messageType].push(currentTurn);
  
  // Calculate spam penalty based on recent repetition
  let spamPenalty = 1.0; // No penalty initially
  let shouldLockout = false;
  
  if (recentCount >= 3) {
    // Fourth repetition - lockout for 3 turns
    shouldLockout = true;
    spamPenalty = 0.0; // No trust effect
  } else if (recentCount >= 2) {
    spamPenalty = -1.0; // Third repetition gives penalty
  } else if (recentCount >= 1) {
    spamPenalty = 0.0; // Second repetition gives no reward
  }
  
  return {
    spamPenalty: spamPenalty,
    recentCount: recentCount,
    isSpam: recentCount >= 1,
    shouldLockout: shouldLockout
  };
}

function isLocked(target) {
  if (!communicationLockouts[target]) return false;
  
  const lockout = communicationLockouts[target];
  const turnsLeft = (lockout.endTurn - turnNumber);
  
  if (turnsLeft <= 0) {
    // Lockout expired, remove it
    delete communicationLockouts[target];
    return false;
  }
  
  return turnsLeft;
}

function lockoutCommunication(target, turns = 3) {
  communicationLockouts[target] = {
    startTurn: turnNumber,
    endTurn: turnNumber + turns,
    reason: 'excessive_repetition'
  };
  
  console.log(`${target} refuses to speak with you for ${turns} turns due to excessive repetition.`);
}

function sendQuickMessage(type) {
  console.log('sendQuickMessage called with type:', type, 'currentDiplomacyTarget:', currentDiplomacyTarget);
  
  if (!currentDiplomacyTarget) {
    console.log('No diplomacy target selected');
    showPopup('No Target Selected', 'Please select a faction to negotiate with first!', 'error');
    return;
  }
  
  // Check if communication is locked
  const lockoutTurns = isLocked(currentDiplomacyTarget);
  if (lockoutTurns) {
    showPopup('Communication Blocked', `${currentDiplomacyTarget} refuses to speak with you for ${lockoutTurns} more turn(s) due to your repetitive messages.`, 'error');
    return;
  }
  
  // Check for message spam
  const spamCheck = checkMessageSpam(currentDiplomacyTarget, type);
  
  // Show spam warning if needed
  const spamWarningDiv = document.getElementById('spamWarning');
  if (spamCheck.recentCount >= 1) {
    if (spamWarningDiv) {
      spamWarningDiv.style.display = 'block';
      if (spamCheck.recentCount >= 3) {
        spamWarningDiv.innerHTML = '🚫 WARNING: Next repetition will lock communication for 3 turns!';
        spamWarningDiv.style.color = '#ff0000';
        spamWarningDiv.style.fontWeight = 'bold';
      } else if (spamCheck.recentCount >= 2) {
        spamWarningDiv.innerHTML = '� Third repetition will DAMAGE relations!';
        spamWarningDiv.style.color = '#ff6b6b';
        spamWarningDiv.style.fontWeight = 'bold';
      } else {
        spamWarningDiv.innerHTML = '⚠️ Second repetition gives NO diplomatic benefit';
        spamWarningDiv.style.color = '#ff9500';
        spamWarningDiv.style.fontWeight = 'normal';
      }
    }
    
    const warningMessages = [
      "The AI leader notes your repetition with mild annoyance...",
      "Your repetitive messages are starting to anger the AI leader.",
      "DANGER: The AI leader is about to cut off communication!"
    ];
    console.log(warningMessages[Math.min(spamCheck.recentCount - 1, warningMessages.length - 1)]);
  } else if (spamWarningDiv) {
    spamWarningDiv.style.display = 'none';
  }
  
  const quickMessages = {
    greeting: [
      "Greetings, honored neighbor. May peace reign between our peoples.",
      "Salutations! I hope our relations can be mutually beneficial.",
      "Hello there! I come in peace and friendship."
    ],
    compliment: [
      "Your military prowess is truly impressive. I respect your strength.",
      "Your civilization has achieved remarkable things. Well done!",
      "I admire your strategic acumen. You are a worthy leader."
    ],
    warning: [
      "I would advise caution in your current course of action.",
      "Your recent moves concern me. Perhaps we should reconsider our positions.",
      "I hope you understand the implications of your recent decisions."
    ],
    threat: [
      "Continue down this path, and you will face the consequences.",
      "My patience grows thin. Do not test my resolve further.",
      "You would be wise to reconsider your hostility toward my people."
    ],
    request_alliance: [
      "I propose we form an alliance. Together we can achieve great things.",
      "Our civilizations would benefit from a formal alliance. What say you?",
      "I extend an offer of friendship and mutual cooperation."
    ],
    offer_trade: [
      "I believe our peoples would benefit from increased trade relations.",
      "Would you be interested in establishing trade routes between us?",
      "Commerce enriches both our civilizations. Shall we formalize trade?"
    ]
  };
  
  const messages = quickMessages[type];
  if (!messages) return;
  
  const message = messages[Math.floor(Math.random() * messages.length)];
  
  // Add player message to history directly
  if (!messageHistory[currentDiplomacyTarget]) {
    messageHistory[currentDiplomacyTarget] = [];
  }
  
  messageHistory[currentDiplomacyTarget].push({
    from: 'PLAYER',
    message: message,
    turn: turnNumber
  });
  
  // Temporarily disable the button to prevent rapid spam
  const buttonSelectors = {
    'greeting': 'button[onclick="sendQuickMessage(\'greeting\')"]',
    'compliment': 'button[onclick="sendQuickMessage(\'compliment\')"]',
    'warning': 'button[onclick="sendQuickMessage(\'warning\')"]',
    'threat': 'button[onclick="sendQuickMessage(\'threat\')"]',
    'request_alliance': 'button[onclick="sendQuickMessage(\'request_alliance\')"]',
    'offer_trade': 'button[onclick="sendQuickMessage(\'offer_trade\')"]'
  };
  
  const buttonElement = document.querySelector(buttonSelectors[type]);
  if (buttonElement) {
    const originalText = buttonElement.textContent;
    buttonElement.disabled = true;
    buttonElement.style.opacity = '0.5';
    buttonElement.textContent = 'Sending...';
    
    // Re-enable after AI responds
    setTimeout(() => {
      buttonElement.disabled = false;
      buttonElement.style.opacity = '1';
      buttonElement.textContent = originalText;
    }, 2000 + Math.random() * 2000); // Re-enable after 2-4 seconds
  }
  
  // Update display immediately
  loadMessageHistory();
  
  // Show typing indicator
  const messageHistoryDiv = document.getElementById('messageHistory');
  if (messageHistoryDiv) {
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typingIndicator';
    typingIndicator.style.cssText = 'margin: 8px 0; text-align: left; color: var(--muted); font-style: italic; font-size: 10px;';
    typingIndicator.innerHTML = `<span style="color: ${getTeamColorHex(currentDiplomacyTarget)};">${currentDiplomacyTarget}</span> is considering...`;
    messageHistoryDiv.appendChild(typingIndicator);
    messageHistoryDiv.scrollTop = messageHistoryDiv.scrollHeight;
  } else {
    console.error('messageHistory element not found');
  }
  
  // Generate AI response after delay
  setTimeout(() => {
    // Remove typing indicator
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
    
    const aiResponse = generateAIResponse(currentDiplomacyTarget, message, type, spamCheck);
    messageHistory[currentDiplomacyTarget].push({
      from: currentDiplomacyTarget,
      message: aiResponse.message,
      turn: turnNumber
    });
    
    // Handle lockout if triggered
    if (spamCheck.shouldLockout) {
      lockoutCommunication(currentDiplomacyTarget, 3);
      // Update UI to show lockout
      updateDiplomacyTarget();
      return; // Exit early, no trust changes
    }
    
    // Apply diplomatic effects with spam penalty
    if (aiResponse.trustChange) {
      let finalTrustChange = 0;
      
      if (spamCheck.spamPenalty === 0.0) {
        // No trust change (second repetition or lockout)
        finalTrustChange = 0;
      } else if (spamCheck.spamPenalty === -1.0) {
        // Penalty (third repetition)
        finalTrustChange = -Math.abs(aiResponse.trustChange); // Convert to negative
      } else {
        // Normal trust change (first time or non-spam)
        finalTrustChange = Math.round(aiResponse.trustChange * spamCheck.spamPenalty);
      }
      
      if (finalTrustChange !== 0) {
        modifyTrust('PLAYER', currentDiplomacyTarget, finalTrustChange);
        modifyTrust(currentDiplomacyTarget, 'PLAYER', finalTrustChange * 0.8);
      }
      
      // Show appropriate feedback
      if (spamCheck.isSpam) {
        if (spamCheck.recentCount >= 2) {
          console.log(`Trust penalty applied: ${finalTrustChange} (repetition punishment)`);
        } else if (spamCheck.recentCount >= 1) {
          console.log(`No trust gained due to message repetition`);
        }
      }
    }
    
    loadMessageHistory();
    updateDiplomacyTarget(); // Refresh trust display
  }, 1500 + Math.random() * 2000); // 1.5-3.5 second delay
}

function proposeTreaty() {
  const treatyTypeSelect = document.getElementById('treatyTypeSelect');
  const treatyType = treatyTypeSelect ? treatyTypeSelect.value : '';
  
  if (!treatyType || !currentDiplomacyTarget) return;
  
  // Check if treaty already exists
  if (hasTreaty('PLAYER', currentDiplomacyTarget, treatyType)) {
    showPopup('Treaty Exists', 'You already have this type of treaty with this faction!', 'info');
    return;
  }
  
  // Show treaty terms and consequences
  const treatyInfo = TREATY_TYPES[treatyType];
  const treatyDisplayName = treatyInfo.name;
  const description = treatyInfo.description;
  const duration = treatyInfo.duration || 20;
  
  // Calculate breaking costs
  const breakingCosts = {
    'NON_AGGRESSION': '3 gold',
    'DEFENSIVE_PACT': '10 gold', 
    'TRADE_AGREEMENT': 'nothing (free to break)'
  };
  const breakCost = breakingCosts[treatyType] || '0';
  
  // Get treaty-specific benefits and restrictions
  let benefits = '';
  let restrictions = '';
  
  switch(treatyType) {
    case 'NON_AGGRESSION':
      benefits = '• Prevents war declarations\n• Improves diplomatic relations\n• Shows peaceful intentions';
      restrictions = '• Cannot attack this faction\n• Cannot declare war until broken\n• Must pay 3 gold to break';
      break;
    case 'TRADE_AGREEMENT':
      benefits = '• Enables resource trading\n• Economic cooperation\n• Improved trust over time';
      restrictions = '• Cannot declare war until broken\n• Economic dependency\n• Free to break anytime';
      break;
    case 'DEFENSIVE_PACT':
      benefits = '• Mutual defense agreement\n• Strong diplomatic ties\n• Military cooperation';
      restrictions = '• Must defend ally if attacked\n• Cannot attack this faction\n• Costs 10 gold to break';
      break;
  }
  
  const confirmationMessage = `Propose ${treatyDisplayName} with ${currentDiplomacyTarget}?
  
📜 TREATY TERMS:
${description}

⏰ Duration: ${duration} turns

✅ BENEFITS:
${benefits}

⚠️ RESTRICTIONS:
${restrictions}

💰 Breaking Cost: ${breakCost}

The AI will evaluate your proposal based on:
• Current trust level
• Their personality type  
• Military power balance
• Existing diplomatic relations

Do you want to proceed with this proposal?`;
  
  const confirmation = confirm(confirmationMessage);
  if (!confirmation) {
    return;
  }
  
  // Evaluate AI response to treaty proposal
  const aiResponse = evaluateTreatyProposal(currentDiplomacyTarget, treatyType);
  
  // Add proposal message to history
  if (!messageHistory[currentDiplomacyTarget]) {
    messageHistory[currentDiplomacyTarget] = [];
  }
  
  const treatyName = TREATY_TYPES[treatyType].name;
  messageHistory[currentDiplomacyTarget].push({
    from: 'PLAYER',
    message: `I propose we establish a ${treatyName} between our civilizations.`,
    turn: turnNumber
  });
  
  // Generate AI response
  setTimeout(() => {
    if (aiResponse.accepted) {
      // Create the treaty
      createTreaty('PLAYER', currentDiplomacyTarget, treatyType, 20); // 20 turn duration
      
      messageHistory[currentDiplomacyTarget].push({
        from: currentDiplomacyTarget,
        message: aiResponse.message,
        turn: turnNumber
      });
      
      // Positive trust boost for successful treaty
      modifyTrust('PLAYER', currentDiplomacyTarget, 15);
      modifyTrust(currentDiplomacyTarget, 'PLAYER', 15);
      
      // Immediate UI update for successful treaty
      updateDiplomacyTarget(); // Refresh displays immediately
      updateDiplomacyUI(); // Update main diplomacy panel immediately
      
   } else {
      messageHistory[currentDiplomacyTarget].push({
        from: currentDiplomacyTarget,
        message: aiResponse.message,
        turn: turnNumber
      });
      
      // Small negative trust for rejection
      modifyTrust(currentDiplomacyTarget, 'PLAYER', -3);
    }
    
    loadMessageHistory();
    updateDiplomacyTarget(); // Refresh displays
    updateDiplomacyUI(); // Update main diplomacy panel
  }, 1500 + Math.random() * 1500);
  
  if (treatyTypeSelect) treatyTypeSelect.value = '';
  loadMessageHistory();
}

function breakAllTreaties() {
  if (!currentDiplomacyTarget) {
    showPopup('No Target Selected', 'Please select a faction first!', 'error');
    return;
  }
  
  // Find all active treaties with this faction
  const activeTreaties = diplomacy.treaties.filter(treaty => 
    treaty.active && 
    treaty.participants.includes('PLAYER') && 
    treaty.participants.includes(currentDiplomacyTarget)
  );
  
  if (activeTreaties.length === 0) {
    showPopup('No Treaties', `You have no active treaties with ${currentDiplomacyTarget}.`, 'info');
    return;
  }
  
  // Calculate total breaking costs
  let totalGoldCost = 0;
  let treatyList = '';
  activeTreaties.forEach(treaty => {
    const costs = { 'NON_AGGRESSION': 3, 'DEFENSIVE_PACT': 10, 'TRADE_AGREEMENT': 0 };
    const cost = costs[treaty.type] || 0;
    totalGoldCost += cost;
    const costText = cost > 0 ? ` (${cost} gold)` : ' (free)';
    treatyList += `• ${TREATY_TYPES[treaty.type].name}${costText}\n`;
  });
  
  const confirmation = confirm(`Break all treaties with ${currentDiplomacyTarget}?\n\nTreaties to break:\n${treatyList}\nTotal cost: ${totalGoldCost} gold\n\nThis will:\n- End all diplomatic agreements\n- Damage trust and reputation\n- Pay compensation to ${currentDiplomacyTarget}\n- Allow war declarations if desired`);
  
  if (confirmation) {
    let brokenCount = 0;
    let failedCount = 0;
    
    activeTreaties.forEach(treaty => {
      if (breakTreaty(treaty, 'PLAYER', 'Player ended treaty')) {
        brokenCount++;
      } else {
        failedCount++;
      }
    });
    
    if (brokenCount > 0) {
      showPopup('Treaties Broken', `Successfully broke ${brokenCount} treaties with ${currentDiplomacyTarget}.${failedCount > 0 ? ` ${failedCount} treaties could not be broken due to insufficient resources.` : ''}`, 'success');
      updateDiplomacyTarget(); // Refresh displays
      updateDiplomacyUI(); // Update main diplomacy panel
    } else {
      showPopup('Cannot Break Treaties', 'No treaties could be broken due to insufficient resources.', 'error');
    }
  }
}

function declareWarOnTarget() {
  if (!currentDiplomacyTarget) {
    showPopup('No Target Selected', 'Please select a faction first!', 'error');
    return;
  }
  
  // Check if already at war
  if (isAtWar('PLAYER', currentDiplomacyTarget)) {
    showPopup('Already At War', `You are already at war with ${currentDiplomacyTarget}!`, 'info');
    return;
  }
  
  const confirmation = confirm(`Are you sure you want to declare war on ${currentDiplomacyTarget}?\n\nThis will:\n- Break all existing treaties\n- Allow attacks starting next turn\n- Severely damage diplomatic relations\n- Other factions may respond negatively`);
  
  if (confirmation) {
    const success = declareWar('PLAYER', currentDiplomacyTarget);
    if (success) {
      showPopup('War Declared', `War declared on ${currentDiplomacyTarget}! You may attack starting next turn.`, 'success');
      updateDiplomacyTarget(); // Refresh displays
      updateDiplomacyUI(); // Update main diplomacy panel
    }
  }
}

function markAllMessagesRead() {
  if (diplomacy.aiMessages) {
    diplomacy.aiMessages.forEach(msg => msg.read = true);
    diplomacy.unreadMessages = 0;
    updateNotificationBubble();
    loadMessageHistory(); // Refresh the combined message history
    
    // Refresh the faction buttons to update notification bubbles
    const targetButtons = document.getElementById('diplomacyTargetButtons');
    if (targetButtons) {
      const activeTeams = getActiveTeams();
      let buttonsHTML = '';
      
      activeTeams.forEach(team => {
        if (team !== 'PLAYER' && isAITeam(team)) {
          const personality = diplomacy.personalities[team] ? AI_PERSONALITIES[diplomacy.personalities[team]].name : 'Unknown';
          const teamColor = getTeamColorHex(team);
          const unreadCount = getUnreadMessagesFromTeam(team);
          const notificationBubble = unreadCount > 0 ? 
            `<div style="position: absolute; top: -5px; right: -5px; background: #ff4757; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; z-index: 10;">${unreadCount}</div>` : '';
          
          const isSelected = currentDiplomacyTarget === team;
          const border = isSelected ? '2px solid var(--accent)' : '2px solid transparent';
          
          buttonsHTML += `<button onclick="selectDiplomacyTarget('${team}')" style="padding: 8px 12px; background: ${teamColor}; color: white; border: ${border}; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: transform 0.1s; position: relative;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${team}<br><span style="font-size: 9px; opacity: 0.8;">${personality}</span>${notificationBubble}</button>`;
        }
      });
      
      targetButtons.innerHTML = buttonsHTML;
    }
  }
}



function getMessageTypeIcon(type) {
  switch (type) {
    case 'WAR_DECLARATION': return '⚔️';
    case 'WAR_RESPONSE': return '🛡️';
    case 'THREAT_RESPONSE': return '😠';
    case 'PEACE_REQUEST': return '🕊️';
    case 'PEACE_RESPONSE': return '☮️';
    case 'COMPLIMENT': return '👍';
    case 'WARNING': return '⚠️';
    case 'THREAT': return '😡';
    case 'GREETING': return '👋';
    case 'ALLIANCE_OFFER': return '🤝';
    case 'TRADE_OFFER': return '💰';
    case 'TRADE_PROPOSAL': return '💱';
    case 'TRADE_RESPONSE': return '💼';
    case 'TREATY_OFFER': return '📜';
    case 'COALITION_WARNING': return '🤝';
    case 'POWER_WARNING': return '⚠️';
    case 'DOMINANCE_FLEX': return '💪';
    case 'DOMINANCE_DISPLAY': return '👑';
    case 'SETTLEMENT_LOST': return '🏰';
    case 'SETTLEMENT_CAPTURED': return '🏴';
    case 'UNIT_KILLED': return '💀';
    case 'UNIT_VICTORY': return '⚔️';
    default: return '💬';
  }
}

function getMessageTypeLabel(type) {
  switch (type) {
    case 'WAR_DECLARATION': return 'War Declaration';
    case 'WAR_RESPONSE': return 'War Response';
    case 'THREAT_RESPONSE': return 'Threat Response';
    case 'PEACE_REQUEST': return 'Peace Request';
    case 'PEACE_RESPONSE': return 'Peace Response';
    case 'COMPLIMENT': return 'Compliment';
    case 'WARNING': return 'Warning';
    case 'THREAT': return 'Threat';
    case 'GREETING': return 'Greeting';
    case 'ALLIANCE_OFFER': return 'Alliance Offer';
    case 'TRADE_OFFER': return 'Trade Offer';
    case 'TRADE_PROPOSAL': return 'Trade Proposal';
    case 'TRADE_RESPONSE': return 'Trade Response';
    case 'TREATY_OFFER': return 'Treaty Offer';
    case 'COALITION_WARNING': return 'Coalition Warning';
    case 'POWER_WARNING': return 'Power Warning';
    case 'DOMINANCE_FLEX': return 'Show of Force';
    case 'DOMINANCE_DISPLAY': return 'Dominance Display';
    case 'SETTLEMENT_LOST': return 'Settlement Lost';
    case 'SETTLEMENT_CAPTURED': return 'Settlement Captured';
    case 'UNIT_KILLED': return 'Unit Defeated';
    case 'UNIT_VICTORY': return 'Unit Victory';
    case 'GENERAL': return 'Message';
    default: return 'Message';
  }
}

function generateAIResponse(aiTeam, playerMessage, messageType = null, spamCheck = null) {
  const personality = diplomacy.personalities[aiTeam] ? AI_PERSONALITIES[diplomacy.personalities[aiTeam]] : AI_PERSONALITIES.BALANCED;
  const trust = getTrust(aiTeam, 'PLAYER');
  const reputation = getReputation('PLAYER', aiTeam);
  
  // Use specific responses based on message type if provided
  if (messageType) {
    return generateTypedResponse(aiTeam, messageType, personality, trust, reputation, spamCheck);
  }
  
  // Analyze message sentiment for generic messages
  const message = playerMessage.toLowerCase();
  let sentiment = 0; // -1 to 1
  
  // Positive words
  if (message.includes('peace') || message.includes('friend') || message.includes('honor') || message.includes('respect')) sentiment += 0.3;
  if (message.includes('alliance') || message.includes('cooperation') || message.includes('mutual')) sentiment += 0.2;
  
  // Negative words  
  if (message.includes('war') || message.includes('attack') || message.includes('destroy') || message.includes('enemy')) sentiment -= 0.4;
  if (message.includes('threaten') || message.includes('consequences') || message.includes('hostil')) sentiment -= 0.3;
  
  // Calculate power dynamics for response modification
  const playerPower = calculateFactionPower('PLAYER');
  const aiPower = calculateFactionPower(aiTeam);
  const powerRatio = aiPower / Math.max(playerPower, 1);
  const isSignificantlyWeaker = powerRatio < 0.5;
  const isWeaker = powerRatio < 0.7;
  const isSignificantlyStronger = powerRatio > 2.0;
  
  // Generate response based on personality, trust, and sentiment
  let responses = [];
  let trustChange = 0;
  
  if (sentiment > 0.2) {
    // Positive message
    trustChange = Math.round(sentiment * 5 * (personality.cooperativeness || 0.5));
    responses = personality.friendlyResponses || [
      "Your words are welcome. I appreciate your diplomatic approach.",
      "Indeed, cooperation benefits us both. I am pleased by your message.",
      "Your peaceful intentions are noted and respected."
    ];
  } else if (sentiment < -0.2) {
    // Negative message
    trustChange = Math.round(sentiment * 3 * (1 - (personality.cooperativeness || 0.5)));
    responses = personality.hostileResponses || [
      "Your threats do not intimidate me. Choose your words more carefully.",
      "Such hostility is unbecoming. I expected better from you.",
      "Your aggression is noted. This does not bode well for our relations."
    ];
  } else {
    // Neutral message
    trustChange = Math.round((Math.random() - 0.5) * 2);
    responses = personality.neutralResponses || [
      "I acknowledge your message. Our relationship remains... complex.",
      "Your words are heard. Time will tell where our paths lead.",
      "Interesting. I will consider what you have said."
    ];
  }
  
  // POWER-BASED RESPONSE MODIFICATIONS
  if (isSignificantlyWeaker) {
    // Significantly weaker AI is much more agreeable and deferential
    trustChange = Math.max(trustChange, 1); // Always at least slightly positive
    if (sentiment >= 0) trustChange += 3; // Extra positive for non-negative messages
    
    const deferentialResponses = [
      "Your wisdom guides this conversation well. I am inclined to agree with your perspective.",
      "Indeed, your point is well-taken. I respect your superior position in these matters.",
      "You speak with the authority of strength. I find your words quite reasonable.",
      "Your diplomatic skill matches your military prowess. I am receptive to your suggestions."
    ];
    
    // Replace responses with more agreeable ones
    if (sentiment >= -0.1) { // Not strongly negative
      responses = deferentialResponses;
    }
  } else if (isWeaker) {
    // Moderately weaker AI is more agreeable
    if (sentiment >= 0) trustChange += 2;
    trustChange = Math.max(trustChange, 0); // Never negative for neutral/positive messages
  } else if (isSignificantlyStronger) {
    // Significantly stronger AI is more dismissive and arrogant
    trustChange = Math.min(trustChange, 0); // Never positive
    if (sentiment < 0) trustChange -= 2; // Extra negative for negative messages
    
    const arrogantResponses = [
      "Your words are... quaint. I suppose I can spare a moment to address your concerns.",
      "How presumptuous. Still, I will consider your request, though I doubt it merits my attention.",
      "Amusing. Do you truly believe you are in a position to make demands of me?",
      "I grow weary of this discourse. Speak quickly if you have something worthwhile to say."
    ];
    
    // Replace with arrogant responses for neutral/negative sentiment
    if (sentiment <= 0.1) {
      responses = arrogantResponses;
    }
  }
  
  // Modify response based on current trust level
  if (trust > 40) {
    responses = [
      "My trusted friend, your words carry great weight with me.",
      "As always, I value our continued friendship and cooperation.",
      "Your message is most welcome, dear ally."
    ];
  } else if (trust < -40) {
    responses = [
      "Your words ring hollow given our troubled history.",
      "I have little reason to trust anything you say.",
      "Actions speak louder than words, and yours have been hostile."
    ];
  }
  
  return {
    message: responses[Math.floor(Math.random() * responses.length)],
    trustChange: Math.max(-5, Math.min(5, trustChange)) // Cap trust changes
  };
}

function generateSpamResponse(messageType, personality, trust, recentCount) {
  let spamResponses = [];
  let trustChange = 0;
  
  // Different responses based on how many times they've repeated the message
  if (recentCount >= 3) {
    // Fourth repetition - LOCKOUT responses (very harsh)
    spamResponses = [
      "ENOUGH! I will not suffer your mindless repetition any longer. We are done talking!",
      "Your incessant babbling insults my intelligence. I refuse to hear another word from you!",
      "Silence! Your repetitive drivel has exhausted my patience. Begone!",
      "I have had enough of your mockery! Do not dare speak to me again!",
      "Your words are meaningless noise. I shall ignore you from now on."
    ];
    trustChange = 0; // No trust change, lockout handles the punishment
  } else if (recentCount >= 2) {
    // Third repetition - PENALTY responses (angry)
    spamResponses = [
      "You dare repeat yourself AGAIN? Your disrespect will be remembered!",
      "This is the third time you've said this! Are you trying to insult me?",
      "Your repetition is beyond tiresome - it's offensive! I am not pleased.",
      "Enough of this same meaningless chatter! You try my patience!",
      "Three times the same words? Your lack of respect damages our relations."
    ];
    trustChange = -3; // Penalty applied elsewhere
  } else {
    // Second repetition - NO REWARD responses (dismissive)
    spamResponses = [
      "You've said this before. I heard you the first time.",
      "Yes, yes, you mentioned this already. Nothing has changed.",
      "I recall this exact conversation. Your words carry no new weight.",
      "Repetition does not make your words more meaningful.",
      "As I said before... *sighs* your message is noted."
    ];
    trustChange = 0; // No reward
  }
  
  // Personality-specific additions to spam responses
  if (personality.type === 'AGGRESSIVE') {
    if (recentCount >= 3) {
      spamResponses = [
        "You test a warrior's patience with your repetition! I will hear no more!",
        "Enough of your cowardly repetition! Face me with new words or face my wrath!",
        "Your babbling dishonors us both! I reject your presence!"
      ];
    } else if (recentCount >= 2) {
      spamResponses = [
        "Your repetition shows weakness! A true leader speaks with purpose!",
        "Say something new or prepare for consequences!",
        "This repetition is an act of war against my time!"
      ];
    }
  } else if (personality.type === 'DEFENSIVE') {
    if (recentCount >= 3) {
      spamResponses = [
        "Your persistent repetition makes me very uncomfortable. I must withdraw.",
        "I cannot trust someone who speaks in circles. Our dialogue ends here.",
        "This behavior is... disturbing. I need distance from such conduct."
      ];
    }
  } else if (personality.type === 'TRADER') {
    if (recentCount >= 2) {
      spamResponses = [
        "In business, repetition wastes time and costs money. Stop this.",
        "Efficient communication is valuable. Your repetition is not.",
        "Time is currency. Your repeated words spend mine poorly."
      ];
    }
  }
  
  return {
    message: spamResponses[Math.floor(Math.random() * spamResponses.length)],
    trustChange: trustChange
  };
}

function generateTypedResponse(aiTeam, messageType, personality, trust, reputation, spamCheck = null) {
  let responses = [];
  let trustChange = 0;
  
  // Handle spam responses first
  if (spamCheck && spamCheck.isSpam) {
    return generateSpamResponse(messageType, personality, trust, spamCheck.recentCount);
  }
  
  const responseTemplates = {
    greeting: {
      positive: [
        "Greetings! It is always a pleasure to hear from a respected neighbor.",
        "Well met! Your diplomatic courtesy is much appreciated.",
        "Salutations, friend. I welcome this opportunity for dialogue."
      ],
      neutral: [
        "Greetings. I acknowledge your message with cautious optimism.",
        "Hello. I am willing to listen to what you have to say.",
        "Your greeting is noted. Let us see where this conversation leads."
      ],
      negative: [
        "Your words are hollow pleasantries, but I will hear you out.",
        "Greetings... though our history gives me little reason for warmth.",
        "I acknowledge your attempt at diplomacy, despite our differences."
      ],
      trustBonus: 2
    },
    compliment: {
      positive: [
        "Your kind words honor me. Such respect between leaders is rare.",
        "I am pleased by your acknowledgment. Mutual respect builds bridges.",
        "Your praise is most welcome. It speaks well of your character."
      ],
      neutral: [
        "Your compliment is... unexpected. I appreciate the gesture.",
        "Kind words, though I wonder what motivates such praise.",
        "I accept your compliment with cautious gratitude."
      ],
      negative: [
        "Flattery will not erase the wrongs between us so easily.",
        "Your compliments ring hollow given our troubled past.",
        "Pretty words cannot mask your true intentions."
      ],
      trustBonus: 4
    },
    warning: {
      positive: [
        "Your concern is noted, friend. I value your counsel.",
        "I appreciate the warning from a trusted ally. Thank you.",
        "Your wisdom guides me well. I shall heed your words."
      ],
      neutral: [
        "Your warning is... concerning. I will consider your words carefully.",
        "I hear your caution. Time will tell if it is warranted.",
        "Your advice is noted. I hope our paths need not conflict."
      ],
      negative: [
        "Your 'warning' sounds suspiciously like a threat to me.",
        "I need no advice from one who has proven untrustworthy.",
        "Keep your warnings. I fear nothing from the likes of you."
      ],
      trustBonus: -1
    },
    threat: {
      positive: [
        "Your words wound me, friend. Surely we need not come to this?",
        "I am disappointed by this turn. Our friendship meant much to me.",
        "Such harsh words from an ally... this saddens me greatly."
      ],
      neutral: [
        "Your threat is noted. I hope cooler heads will prevail.",
        "Aggression serves neither of us. Reconsider your position.",
        "Such hostility is unbecoming. Think carefully before you act."
      ],
      negative: [
        // Use dynamic responses for variety
        () => generateDynamicResponse('THREAT_RESPONSE', diplomacy.personalities[aiTeam] || 'BALANCED'),
        () => generateDynamicResponse('THREAT_RESPONSE', diplomacy.personalities[aiTeam] || 'BALANCED'),
        () => generateDynamicResponse('THREAT_RESPONSE', diplomacy.personalities[aiTeam] || 'BALANCED')
      ],
      trustBonus: -6
    },
    request_alliance: {
      positive: [
        "Your proposal has great merit! An alliance would benefit us both.",
        "Yes! Together our civilizations can achieve greatness.",
        "I have long hoped for such cooperation. Let us formalize this bond."
      ],
      neutral: [
        "An interesting proposition. I must consider the implications carefully.",
        "Alliance... it has possibilities. What terms do you propose?",
        "Your offer deserves serious consideration. Give me time to think."
      ],
      negative: [
        "Alliance with you? Our histories suggest otherwise.",
        "I find it difficult to trust someone with your reputation.",
        "An alliance requires trust, something in short supply between us."
      ],
      trustBonus: 3
    },
    offer_trade: {
      positive: [
        "Excellent! Commerce benefits all. I welcome expanded trade.",
        "A wise proposal! Our merchants will prosper from this arrangement.",
        "Trade brings prosperity and peace. I accept your offer gladly."
      ],
      neutral: [
        "Trade has its merits. What specific arrangements do you propose?",
        "Commerce could indeed benefit both our peoples. Tell me more.",
        "An interesting economic opportunity. I am willing to negotiate."
      ],
      negative: [
        "Business with you carries significant risks I must consider.",
        "Trade requires trust in one's partners... something we lack.",
        "Your economic overtures cannot repair our damaged relations so easily."
      ],
      trustBonus: 2
    }
  };
  
  const template = responseTemplates[messageType];
  if (!template) return { message: "I... do not understand.", trustChange: 0 };
  
  // Determine response tone based on trust level and personality
  let responseSet;
  let actualTrustChange = template.trustBonus;
  
  if (trust > 20 || (trust > 0 && personality.cooperativeness > 0.7)) {
    responseSet = template.positive;
    actualTrustChange = Math.round(actualTrustChange * 1.2);
  } else if (trust < -20 || (trust < 0 && personality.cooperativeness < 0.3)) {
    responseSet = template.negative;
    actualTrustChange = Math.round(actualTrustChange * 0.5);
  } else {
    responseSet = template.neutral;
  }
  
  // Personality modifiers
  if (personality.type === 'AGGRESSIVE' && (messageType === 'threat' || messageType === 'warning')) {
    actualTrustChange += 1; // Aggressive AIs respect strength
  } else if (personality.type === 'TRADER' && messageType === 'offer_trade') {
    actualTrustChange += 2; // Traders love trade offers
  } else if (personality.type === 'DEFENSIVE' && messageType === 'request_alliance') {
    actualTrustChange += 1; // Defensive AIs like alliances
  }
  
  // Select response - handle both strings and functions
  const selectedResponse = responseSet[Math.floor(Math.random() * responseSet.length)];
  const message = typeof selectedResponse === 'function' ? selectedResponse() : selectedResponse;
  
  return {
    message: message,
    trustChange: Math.max(-8, Math.min(6, actualTrustChange))
  };
}

function evaluateTreatyProposal(aiTeam, treatyType) {
  const personality = diplomacy.personalities[aiTeam] ? AI_PERSONALITIES[diplomacy.personalities[aiTeam]] : AI_PERSONALITIES.BALANCED;
  const trust = getTrust(aiTeam, 'PLAYER');
  const reputation = getReputation('PLAYER', aiTeam);
  
  // Calculate power dynamics
  const playerPower = calculateFactionPower('PLAYER');
  const aiPower = calculateFactionPower(aiTeam);
  const powerRatio = aiPower / Math.max(playerPower, 1);
  const isSignificantlyWeaker = powerRatio < 0.5;
  const isWeaker = powerRatio < 0.7;
  const isSignificantlyStronger = powerRatio > 2.0;
  
  // Check if this AI recently begged for peace (makes them much more likely to accept)
  let hasRecentlyBeggedForPeace = false;
  if (diplomacy.peaceBeggingFlags && diplomacy.peaceBeggingFlags[aiTeam]) {
    if (turnNumber <= diplomacy.peaceBeggingFlags[aiTeam]) {
      hasRecentlyBeggedForPeace = true;
    } else {
      delete diplomacy.peaceBeggingFlags[aiTeam]; // Clean up expired flags
    }
  }
  
  // Base acceptance chance based on trust and reputation
  let acceptanceChance = 0.3; // 30% base
  acceptanceChance += (trust / 100) * 0.4; // Trust influence
  acceptanceChance += (reputation / 100) * 0.2; // Reputation influence
  acceptanceChance += (personality.cooperativeness || 0.5) * 0.3; // Personality influence
  
  // Major boost if AI recently begged for peace
  if (hasRecentlyBeggedForPeace && treatyType === 'NON_AGGRESSION') {
    acceptanceChance += 0.7; // Huge boost for peace treaties when they begged for peace
    console.log(`${aiTeam} recently begged for peace - major acceptance boost for peace treaty`);
  }
  
  // POWER-BASED ACCEPTANCE MODIFICATIONS
  if (isSignificantlyWeaker) {
    // Significantly weaker AI is much more likely to accept treaties
    acceptanceChance += 0.5; // Major boost
    console.log(`${aiTeam} is significantly weaker (${powerRatio.toFixed(2)}x) - major treaty acceptance boost`);
  } else if (isWeaker) {
    // Moderately weaker AI is more likely to accept
    acceptanceChance += 0.3; // Moderate boost
    console.log(`${aiTeam} is weaker (${powerRatio.toFixed(2)}x) - moderate treaty acceptance boost`);
  } else if (isSignificantlyStronger) {
    // Significantly stronger AI is much less likely to accept treaties
    acceptanceChance -= 0.6; // Major penalty
    console.log(`${aiTeam} is significantly stronger (${powerRatio.toFixed(2)}x) - major treaty acceptance penalty`);
  }
  
  // Treaty-specific modifiers
  if (treatyType === 'NON_AGGRESSION') {
    acceptanceChance += 0.2; // Generally easier to accept
    if (personality.type === 'DEFENSIVE') acceptanceChance += 0.3;
  } else if (treatyType === 'TRADE_AGREEMENT') {
    if (personality.type === 'TRADER') acceptanceChance += 0.4;
    if (personality.type === 'AGGRESSIVE') acceptanceChance -= 0.1;
  } else if (treatyType === 'DEFENSIVE_PACT') {
    acceptanceChance -= 0.1; // Harder to accept
    if (personality.type === 'DEFENSIVE') acceptanceChance += 0.2;
    if (trust < 20) acceptanceChance -= 0.3; // Need high trust
  }
  
  const accepted = Math.random() < acceptanceChance;
  
  let message;
  if (accepted) {
    const acceptMessages = [
      "Your proposal has merit. I accept this treaty in the spirit of cooperation.",
      "Very well. This agreement shall benefit both our peoples.",
      "I find your terms acceptable. Let us formalize this pact.",
      "Agreed. May this treaty mark the beginning of a prosperous partnership."
    ];
    message = acceptMessages[Math.floor(Math.random() * acceptMessages.length)];
  } else {
    let rejectMessages = [
      "I cannot accept these terms at this time. Perhaps in the future...",
      "Your proposal is premature. We must build more trust first.",
      "I find these terms... unfavorable. I must decline.",
      "The time is not right for such an agreement. Perhaps later."
    ];
    
    // Power-based rejection messages
    if (isSignificantlyStronger) {
      const arrogantRejects = [
        "Treaties? I need no such arrangements with lesser powers. My strength is sufficient.",
        "Your offer amuses me, but I have no use for alliances with the weak.",
        "I decline. My armies are more than capable of handling any threats without your... assistance.",
        "Why would I bind myself to treaties when I am strong enough to take what I desire?"
      ];
      message = arrogantRejects[Math.floor(Math.random() * arrogantRejects.length)];
    } else if (trust < -20) {
      // More hostile rejection if trust is very low
      const hostileRejects = [
        "Absolutely not. I do not negotiate with those I cannot trust.",
        "Your proposal insults me. Our relations are far too poor for this.",
        "I reject your offer outright. Your past actions speak against you."
      ];
      message = hostileRejects[Math.floor(Math.random() * hostileRejects.length)];
    } else {
      message = rejectMessages[Math.floor(Math.random() * rejectMessages.length)];
    }
  }
  
  return { accepted, message };
}
