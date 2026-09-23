// Warborn source split from the original game.js.
// Section: js/data/units-and-build.js

const UNIT_TEMPLATES = {
  // === BASIC COMBAT UNITS ===
  
  // Light infantry - cheap, versatile, good for early game and swarm tactics
  Soldier: { hp: 50, move: 3, atkRange: 1, dmg: 15, cost: 2 },
  
  // Anti-cavalry specialist - good damage, moderate cost, counters mounted units
  Spearman: { hp: 80, move: 2, atkRange: 1, dmg: 22, cost: 4 },
  
  // Ranged unit - vulnerable but can attack at distance, excellent for support
  Archer: { hp: 50, move: 3, atkRange: 2, dmg: 16, cost: 3 },
  
  // Balanced melee fighter - good HP and damage, reliable mid-game unit
  Swordsman: { hp: 110, move: 2, atkRange: 1, dmg: 20, cost: 5 },
  
  // === SPECIALIZED UNITS ===
  
  // High-mobility glass cannon - fast movement, devastating damage, low HP
  Assassin: { hp: 50, move: 4, atkRange: 1, dmg: 40, cost: { gold: 6, materials: 1 } },
  
  // Heavy cavalry - high HP and damage, slow but powerful, bonus vs Dragons
  Knight: { hp: 150, move: 2, atkRange: 1, dmg: 28, cost: { gold: 7, materials: 3 } },
  
  // Siege weapon - long range, high damage, very slow, vulnerable to melee
  Catapult: { hp: 80, move: 1, atkRange: 3, dmg: 35, cost: { gold: 8, materials: 4 } },
  
  // Ultimate unit - high stats all around, expensive, has damage resistances  
  Dragon: { hp: 200, move: 3, atkRange: 2, dmg: 40, cost: { gold: 15, materials: 8 } },
  
  // Support unit - no combat damage, but can heal other units, high mobility
  // Heals friendly units within range each turn
  Cleric: { hp: 60, move: 5, atkRange: 2, dmg: 0, cost: 5 },
  // === NAVAL UNITS ===
  // These can only move on water tiles and have special naval combat bonuses
  
  // Light naval unit - fast, cheap, good for scouting and harassment
  Sloop: { hp: 70, move: 4, atkRange: 1, dmg: 18, cost: { gold: 4, materials: 2 }, isWaterUnit: true },
  
  // Heavy naval unit - balanced combat ship with good firepower
  'Man-of-War': { hp: 120, move: 3, atkRange: 2, dmg: 30, cost: { gold: 9, materials: 4 }, isWaterUnit: true },
  
  // Ultimate naval unit - slow but devastating, heavily armored
  Battleship: { hp: 200, move: 2, atkRange: 3, dmg: 45, cost: { gold: 18, materials: 12 }, isWaterUnit: true },
  
  // === DEFENSIVE STRUCTURES (FORTRESSES) ===
  // These are immobile but provide area denial and passive healing
  
  // Basic fortification - cheap defensive structure
  Stockade: { 
    hp: 50, move: 0, atkRange: 1, dmg: 6, cost: { gold: 2, materials: 1 }, 
    fortress: true, damageReduction: 0.0, healPerTurn: 0 
  },
  
  // Advanced fortification - good defense with healing capability
  Castle: { 
    hp: 150, move: 0, atkRange: 2, dmg: 12, cost: { gold: 5, materials: 4 }, 
    fortress: true, damageReduction: 0.10, healPerTurn: 1 
  },
  
  // Ultimate fortification - maximum defense and healing
  'Heavy Fortress': { 
    hp: 300, move: 0, atkRange: 2, dmg: 18, cost: { gold: 8, materials: 8 }, 
    fortress: true, damageReduction: 0.30, healPerTurn: 3 
  },
  
  // Legacy alias for backwards compatibility
  Fortress: { 
    hp: 150, move: 0, atkRange: 2, dmg: 12, cost: { gold: 5, materials: 4 }, 
    fortress: true, damageReduction: 0.10, healPerTurn: 1 
  }
};

// Unit Experience and Promotion System
const PROMOTION_LEVELS = {
  0: { name: 'Recruit', bonuses: { hp: 0, dmg: 0, move: 0 }, xpRequired: 0 },
  1: { name: 'Private', bonuses: { hp: 8, dmg: 2, move: 0 }, xpRequired: 15 },
  2: { name: 'Corporal', bonuses: { hp: 18, dmg: 5, move: 0 }, xpRequired: 35 },
  3: { name: 'Sergeant', bonuses: { hp: 30, dmg: 8, move: 1 }, xpRequired: 70 },
  4: { name: 'Elite', bonuses: { hp: 45, dmg: 12, move: 1 }, xpRequired: 120 }
};

const EXPERIENCE_GAINS = {
  KILL_UNIT: 15,
  DAMAGE_DEALT: 1, // 1 XP per 5 damage dealt
  SURVIVE_COMBAT: 5,
  CAPTURE_SETTLEMENT: 10,
  DEFEND_SETTLEMENT: 8
};

function awardExperience(unit, xpAmount, reason = '') {
  if (!unit || unit.experience === undefined) return;
  
  unit.experience += xpAmount;
  console.log(`${unit.name} (${unit.team}) gained ${xpAmount} XP (${reason}). Total: ${unit.experience}`);
  
  // Check for promotion
  const currentLevel = unit.promotionLevel || 0;
  const nextLevel = currentLevel + 1;
  
  if (PROMOTION_LEVELS[nextLevel] && unit.experience >= PROMOTION_LEVELS[nextLevel].xpRequired) {
    promoteUnit(unit);
  }
}

function promoteUnit(unit) {
  const oldLevel = unit.promotionLevel || 0;
  const newLevel = oldLevel + 1;
  
  if (!PROMOTION_LEVELS[newLevel]) return false;
  
  const promotion = PROMOTION_LEVELS[newLevel];
  unit.promotionLevel = newLevel;
  
  // Apply stat bonuses
  unit.maxHp += promotion.bonuses.hp;
  unit.hp += promotion.bonuses.hp; // Also heal unit on promotion
  unit.dmg += promotion.bonuses.dmg;
  unit.move = isFortressUnit(unit) ? 0 : unit.move + promotion.bonuses.move;
  
  const levelName = promotion.name ? ` ${promotion.name}` : '';
  console.log(`🌟 ${unit.name} promoted to${levelName}! New stats: ${unit.hp}/${unit.maxHp} HP, ${unit.dmg} DMG, ${unit.move} Move`);
  try { SoundManager.playRankUp(unit); } catch (e) {}
  
  // Visual feedback
  if (unit.team === 'PLAYER') {
    setTimeout(() => {
      showPopup(
        '🌟 Unit Promoted!',
        `${unit.name} is now ${promotion.name}!\n\n+${promotion.bonuses.hp} HP\n+${promotion.bonuses.dmg} Damage\n+${promotion.bonuses.move} Movement`,
        'success'
      );
    }, 500);
  }
  
  return true;
}

function getUnitDisplayName(unit) {
  if (!unit.promotionLevel || unit.promotionLevel === 0) return unit.name;
  const promotion = PROMOTION_LEVELS[unit.promotionLevel];
  return promotion && promotion.name ? `${promotion.name} ${unit.name}` : unit.name;
}

function getPromotionProgress(unit) {
  const currentLevel = unit.promotionLevel || 0;
  const nextLevel = currentLevel + 1;
  
  if (!PROMOTION_LEVELS[nextLevel]) {
    return { progress: 1.0, current: unit.experience, needed: 0, nextRank: 'Max Level' };
  }
  
  const currentXP = unit.experience || 0;
  const neededXP = PROMOTION_LEVELS[nextLevel].xpRequired;
  const previousXP = currentLevel > 0 ? PROMOTION_LEVELS[currentLevel].xpRequired : 0;
  
  return {
    progress: Math.min(1.0, (currentXP - previousXP) / (neededXP - previousXP)),
    current: currentXP,
    needed: neededXP,
    nextRank: PROMOTION_LEVELS[nextLevel].name
  };
}

// Helper function to calculate total cost of a unit (for AI and filtering)
function getTotalCost(unitName) {
  const template = UNIT_TEMPLATES[unitName];
  if (!template) return 0;
  const cost = template.cost;
  if (typeof cost === 'number') return cost; // Backward compatibility
  return (cost.gold || 0) + (cost.materials || 0);
}

// Helper function to calculate cost efficiency for AI decision making
function getCostEfficiency(unitName) {
  const template = UNIT_TEMPLATES[unitName];
  if (!template) return 0;
  const totalCost = getTotalCost(unitName);
  if (totalCost === 0) return 0;
  return (template.hp * template.dmg) / totalCost;
}

function allowedUnitsForSettlement(settlementType, team = null){
  // Only non-fortress units can be spawned from settlements.
  // HAMLET: cost <=3, VILLAGE: cost <=6, CITY: any non-fortress
  let allowedUnits = Object.keys(UNIT_TEMPLATES).filter(n => !UNIT_TEMPLATES[n].fortress && !UNIT_TEMPLATES[n].isWaterUnit);
  
  // Filter by settlement level
  if(settlementType === 'HAMLET') allowedUnits = allowedUnits.filter(n => getTotalCost(n) <= 4);
  else if(settlementType === 'VILLAGE') allowedUnits = allowedUnits.filter(n => getTotalCost(n) <= 8);
  // CITY and PORT have no restrictions
  
  // Filter by research requirements if team is specified
  if (team) {
    allowedUnits = allowedUnits.filter(unitType => {
      // Units that don't require research (only 'Soldier' by default) or have been researched
      return !RESEARCH_COSTS[unitType] || hasResearched(team, unitType);
    });
  }
  
  // Naval units are now built like fortresses, not spawned
  
  return allowedUnits;
}

function isFortressUnit(u){
  if(!u||!u.name) return false;
  return ['Stockade','Castle','Heavy Fortress','Fortress'].includes(u.name);
}

function getFortressPropsByName(name){
  if(name === 'Stockade') return { damageReduction: 0.0, healPerTurn: 0 };
  if(name === 'Castle') return { damageReduction: 0.10, healPerTurn: 1 };
  if(name === 'Heavy Fortress') return { damageReduction: 0.30, healPerTurn: 3 };
  // legacy Fortress maps to Castle-ish values
  return { damageReduction: 0.10, healPerTurn: 1 };
}

// Unit emoji mapping for fallback when images aren't available
const UNIT_EMOJIS = {
  // Basic units
  'Soldier': '⚔️',
  'Spearman': '🗡️', 
  'Archer': '🏹',
  'Swordsman': '⚡',
  
  // Advanced units
  'Assassin': '🗡️',
  'Knight': '🛡️',
  'Catapult': '🎯',
  'Dragon': '🐉',
  'Cleric': '⚕️',
  
  // Naval units
  'Sloop': '⛵',
  'Man-of-War': '🚢',
  'Battleship': '⚓',
  
  // Fortresses
  'Stockade': '🚧',
  'Castle': '🏰',
  'Heavy Fortress': '🏯'
};

function getUnitEmoji(unitName) {
  return UNIT_EMOJIS[unitName] || '⚔️';
}

// Get unit image or fallback to emoji
function getUnitIcon(unitName) {
  // Check if image is loaded
  if (IMAGES[unitName] && IMAGE_LOAD_STATUS[unitName] === 'loaded') {
    return { type: 'image', content: IMAGES[unitName] };
  }
  // Fallback to emoji
  return { type: 'emoji', content: getUnitEmoji(unitName) };
}

// Create unit icon element (image or emoji)
function createUnitIcon(unitName, size = 32) {
  const icon = getUnitIcon(unitName);
  
  if (icon.type === 'image') {
    const img = document.createElement('img');
    img.src = icon.content.src;
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    img.style.objectFit = 'contain';
    img.style.imageRendering = 'crisp-edges'; // For pixel art/SVG crispness
    return img;
  } else {
    const emoji = document.createElement('div');
    emoji.style.fontSize = `${size * 0.75}px`;
    emoji.textContent = icon.content;
    return emoji;
  }
}

function openSpawnMenu(col, row, settlement){
  closeSpawnMenu();
  const menu = document.createElement('div');
  menu.id = 'spawnMenu';
  
  // Styled modal backdrop
  menu.style.position = 'fixed';
  menu.style.left = '50%';
  menu.style.top = '50%';
  menu.style.transform = 'translate(-50%, -50%)';
  menu.style.background = 'rgba(6,12,20,0.98)';
  menu.style.color = '#e6eef6';
  menu.style.padding = '0';
  menu.style.borderRadius = '12px';
  menu.style.zIndex = 9999;
  menu.style.minWidth = '400px';
  menu.style.maxWidth = '500px';
  menu.style.boxShadow = '0 8px 32px rgba(0,0,0,0.8)';
  menu.style.border = '1px solid rgba(255,255,255,0.1)';
  
  // Header
  const header = document.createElement('div');
  header.style.padding = '16px 20px';
  header.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
  header.style.background = 'rgba(74,158,255,0.1)';
  header.style.borderRadius = '12px 12px 0 0';
  
  const title = document.createElement('div');
  title.style.fontWeight = '700';
  title.style.fontSize = '16px';
  title.style.color = '#4a9eff';
  title.textContent = `${settlement.owner} - ${settlement.type}`;
  header.appendChild(title);
  
  const subtitle = document.createElement('div');
  subtitle.style.fontSize = '12px';
  subtitle.style.color = '#9aa6b2';
  subtitle.style.marginTop = '4px';
  subtitle.textContent = 'Manage settlement actions';
  header.appendChild(subtitle);
  
  menu.appendChild(header);
  
  // Tab navigation
  const tabNav = document.createElement('div');
  tabNav.style.display = 'flex';
  tabNav.style.background = 'rgba(255,255,255,0.05)';
  tabNav.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
  
  const tabs = [
    { id: 'build', label: '🏗️ Build Units', active: true },
    { id: 'upgrade', label: '⬆️ Upgrade' },
    { id: 'research', label: '🔬 Research' }
  ];
  
  tabs.forEach(tab => {
    const tabBtn = document.createElement('button');
    tabBtn.style.flex = '1';
    tabBtn.style.padding = '12px 8px';
    tabBtn.style.background = tab.active ? 'rgba(74,158,255,0.2)' : 'transparent';
    tabBtn.style.color = tab.active ? '#4a9eff' : '#9aa6b2';
    tabBtn.style.border = 'none';
    tabBtn.style.fontSize = '12px';
    tabBtn.style.fontWeight = '600';
    tabBtn.style.cursor = 'pointer';
    tabBtn.style.transition = 'all 0.2s';
    tabBtn.textContent = tab.label;
    tabBtn.onclick = () => switchTab(tab.id);
    tabNav.appendChild(tabBtn);
  });
  
  menu.appendChild(tabNav);
  
  // Content area
  const content = document.createElement('div');
  content.id = 'tabContent';
  content.style.padding = '20px';
  content.style.maxHeight = '400px';
  content.style.overflowY = 'auto';
  
  menu.appendChild(content);
  
  // Close button
  const footer = document.createElement('div');
  footer.style.padding = '12px 20px';
  footer.style.borderTop = '1px solid rgba(255,255,255,0.1)';
  footer.style.textAlign = 'right';
  footer.style.background = 'rgba(255,255,255,0.02)';
  footer.style.borderRadius = '0 0 12px 12px';
  
  const closeBtn = document.createElement('button');
  closeBtn.style.padding = '8px 16px';
  closeBtn.style.background = 'rgba(255,255,255,0.1)';
  closeBtn.style.color = '#e6eef6';
  closeBtn.style.border = '1px solid rgba(255,255,255,0.2)';
  closeBtn.style.borderRadius = '6px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '12px';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = closeSpawnMenu;
  footer.appendChild(closeBtn);
  
  menu.appendChild(footer);
  
  document.body.appendChild(menu);
  
  // Initialize with build tab
  switchTab('build');
  
  // Tab switching function
  function switchTab(tabId) {
    // Update tab buttons
    tabNav.querySelectorAll('button').forEach((btn, index) => {
      const isActive = tabs[index].id === tabId;
      btn.style.background = isActive ? 'rgba(74,158,255,0.2)' : 'transparent';
      btn.style.color = isActive ? '#4a9eff' : '#9aa6b2';
    });
    
    // Update content
    content.innerHTML = '';
    
    if (tabId === 'build') {
      showBuildTab();
    } else if (tabId === 'upgrade') {
      showUpgradeTab();
    } else if (tabId === 'research') {
      showResearchTab();
    }
  }
  
  function showBuildTab() {
    const allowed = allowedUnitsForSettlement(settlement.type, settlement.owner);
    const researched = allowed.filter(name => hasResearched(settlement.owner, name));
    
    if (researched.length === 0) {
      const noUnits = document.createElement('div');
      noUnits.style.textAlign = 'center';
      noUnits.style.color = '#9aa6b2';
      noUnits.style.padding = '40px 20px';
      noUnits.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 12px;">🔬</div>
        <div>No units available to build</div>
        <div style="font-size: 12px; margin-top: 8px;">Research units first in the Research tab</div>
      `;
      content.appendChild(noUnits);
      return;
    }
    
    researched.forEach(name => {
      const t = UNIT_TEMPLATES[name];
      const unitRow = document.createElement('div');
      unitRow.style.display = 'flex';
      unitRow.style.alignItems = 'center';
      unitRow.style.padding = '12px';
      unitRow.style.marginBottom = '8px';
      unitRow.style.background = 'rgba(255,255,255,0.05)';
      unitRow.style.borderRadius = '8px';
      unitRow.style.border = '1px solid rgba(255,255,255,0.1)';
      unitRow.style.transition = 'all 0.2s ease';
      unitRow.style.cursor = 'default';
      
      // Hover effect
      unitRow.addEventListener('mouseenter', () => {
        unitRow.style.background = 'rgba(74,158,255,0.1)';
        unitRow.style.border = '1px solid rgba(74,158,255,0.3)';
      });
      unitRow.addEventListener('mouseleave', () => {
        unitRow.style.background = 'rgba(255,255,255,0.05)';
        unitRow.style.border = '1px solid rgba(255,255,255,0.1)';
      });
      
      // Unit icon
      const iconContainer = document.createElement('div');
      iconContainer.style.marginRight = '12px';
      iconContainer.style.minWidth = '32px';
      iconContainer.style.height = '32px';
      iconContainer.style.display = 'flex';
      iconContainer.style.alignItems = 'center';
      iconContainer.style.justifyContent = 'center';
      iconContainer.style.background = 'rgba(255,255,255,0.1)';
      iconContainer.style.borderRadius = '6px';
      iconContainer.style.border = '1px solid rgba(255,255,255,0.15)';
      const icon = createUnitIcon(name, 28);
      iconContainer.appendChild(icon);
      unitRow.appendChild(iconContainer);
      
      // Unit info
      const info = document.createElement('div');
      info.style.flex = '1';
      info.innerHTML = `
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">${name}</div>
        <div style="font-size: 11px; color: #9aa6b2;">
          HP: ${t.hp} • Range: ${t.atkRange} • DMG: ${t.dmg} • Move: ${t.move}
        </div>
      `;
      unitRow.appendChild(info);
      
      // Buy button
      const buyBtn = document.createElement('button');
      buyBtn.style.padding = '8px 12px';
      buyBtn.style.background = '#4a9eff';
      buyBtn.style.color = 'white';
      buyBtn.style.border = 'none';
      buyBtn.style.borderRadius = '6px';
      buyBtn.style.cursor = 'pointer';
      buyBtn.style.fontSize = '11px';
      buyBtn.style.fontWeight = '600';
      buyBtn.textContent = `Buy (${formatCost(t.cost)})`;
      buyBtn.onclick = () => { 
        try { 
          spawnUnitAt(name, settlement.owner, col, row);
          closeSpawnMenu();
        } catch(e) { 
          console.warn(e); 
        } 
      };
      unitRow.appendChild(buyBtn);
      
      content.appendChild(unitRow);
    });
  }
  
  function showUpgradeTab() {
    const upgradeDiv = document.createElement('div');
    upgradeDiv.style.textAlign = 'center';
    upgradeDiv.style.padding = '20px';
    
    const currentType = settlement.type;
    let nextType = null;
    let upgradeCost = 15;
    
    if (currentType === 'HAMLET') nextType = 'VILLAGE';
    else if (currentType === 'VILLAGE') nextType = 'CITY';
    
    if (nextType) {
      upgradeDiv.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 16px;">⬆️</div>
        <div style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Upgrade Settlement</div>
        <div style="color: #9aa6b2; margin-bottom: 16px;">
          ${currentType} → ${nextType}
        </div>
        <div style="font-size: 12px; color: #9aa6b2; margin-bottom: 20px;">
          Upgraded settlements provide better income and can build stronger units
        </div>
      `;
      
      const upgradeBtn = document.createElement('button');
      upgradeBtn.style.padding = '12px 24px';
      upgradeBtn.style.background = resources[settlement.owner].gold >= upgradeCost ? '#ffa500' : '#555';
      upgradeBtn.style.color = 'white';
      upgradeBtn.style.border = 'none';
      upgradeBtn.style.borderRadius = '8px';
      upgradeBtn.style.cursor = resources[settlement.owner].gold >= upgradeCost ? 'pointer' : 'not-allowed';
      upgradeBtn.style.fontSize = '14px';
      upgradeBtn.style.fontWeight = '600';
      upgradeBtn.disabled = resources[settlement.owner].gold < upgradeCost;
      upgradeBtn.textContent = `Upgrade (${upgradeCost}G)`;
      upgradeBtn.onclick = () => {
        if (resources[settlement.owner].gold >= upgradeCost) {
          resources[settlement.owner].gold -= upgradeCost;
          settlement.type = nextType;
          console.log(`${settlement.owner} upgraded settlement to ${nextType}`);
          closeSpawnMenu();
          updateUI();
        }
      };
      upgradeDiv.appendChild(upgradeBtn);
    } else {
      upgradeDiv.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 16px;">🏰</div>
        <div style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Maximum Level</div>
        <div style="color: #9aa6b2;">This settlement is already at maximum level</div>
      `;
    }
    
    content.appendChild(upgradeDiv);
  }
  
  function showResearchTab() {
    const researchable = getResearchableUnits(settlement.owner).filter(name => 
      allowedUnitsForSettlement(settlement.type, null).includes(name)
    );
    
    if (researchable.length === 0) {
      const noResearch = document.createElement('div');
      noResearch.style.textAlign = 'center';
      noResearch.style.color = '#9aa6b2';
      noResearch.style.padding = '40px 20px';
      noResearch.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 12px;">🎓</div>
        <div>All available units researched</div>
        <div style="font-size: 12px; margin-top: 8px;">Build higher level settlements to unlock more units</div>
      `;
      content.appendChild(noResearch);
      return;
    }
    
    researchable.forEach(name => {
      const t = UNIT_TEMPLATES[name];
      const cost = RESEARCH_COSTS[name];
      const researchRow = document.createElement('div');
      researchRow.style.display = 'flex';
      researchRow.style.alignItems = 'center';
      researchRow.style.padding = '12px';
      researchRow.style.marginBottom = '8px';
      researchRow.style.background = 'rgba(255,165,0,0.1)';
      researchRow.style.borderRadius = '8px';
      researchRow.style.border = '1px solid rgba(255,165,0,0.2)';
      researchRow.style.transition = 'all 0.2s ease';
      researchRow.style.cursor = 'default';
      
      // Hover effect
      researchRow.addEventListener('mouseenter', () => {
        researchRow.style.background = 'rgba(255,165,0,0.15)';
        researchRow.style.border = '1px solid rgba(255,165,0,0.4)';
      });
      researchRow.addEventListener('mouseleave', () => {
        researchRow.style.background = 'rgba(255,165,0,0.1)';
        researchRow.style.border = '1px solid rgba(255,165,0,0.2)';
      });
      
      // Unit icon (dimmed for unresearched)
      const iconContainer = document.createElement('div');
      iconContainer.style.marginRight = '12px';
      iconContainer.style.minWidth = '32px';
      iconContainer.style.height = '32px';
      iconContainer.style.display = 'flex';
      iconContainer.style.alignItems = 'center';
      iconContainer.style.justifyContent = 'center';
      iconContainer.style.background = 'rgba(255,255,255,0.05)';
      iconContainer.style.borderRadius = '6px';
      iconContainer.style.border = '1px solid rgba(255,255,255,0.1)';
      iconContainer.style.opacity = '0.7';
      const icon = createUnitIcon(name, 28);
      iconContainer.appendChild(icon);
      researchRow.appendChild(iconContainer);
      
      // Unit info
      const info = document.createElement('div');
      info.style.flex = '1';
      info.innerHTML = `
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">${name}</div>
        <div style="font-size: 11px; color: #9aa6b2;">
          HP: ${t.hp} • Range: ${t.atkRange} • DMG: ${t.dmg} • Move: ${t.move}
        </div>
      `;
      researchRow.appendChild(info);
      
      // Research button
      const researchBtn = document.createElement('button');
      researchBtn.style.padding = '8px 12px';
      const canDoResearch = canResearch(settlement.owner, name);
      researchBtn.style.background = canDoResearch ? '#ffa500' : '#555';
      researchBtn.style.color = 'white';
      researchBtn.style.border = 'none';
      researchBtn.style.borderRadius = '6px';
      researchBtn.style.cursor = canDoResearch ? 'pointer' : 'not-allowed';
      researchBtn.style.fontSize = '11px';
      researchBtn.style.fontWeight = '600';
      researchBtn.disabled = !canDoResearch;
      researchBtn.textContent = `Research (${cost}G)`;
      
      // Use addEventListener instead of onclick to avoid skipNextClick interference
      researchBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        console.log(`Research button clicked for ${name}, owner: ${settlement.owner}, canResearch: ${canResearch(settlement.owner, name)}`);
        
        if (researchUnit(settlement.owner, name)) {
          console.log(`Successfully researched ${name} for ${settlement.owner}`);
          showResearchTab(); // Refresh the research tab
          updateUI();
        } else {
          console.log(`Failed to research ${name} for ${settlement.owner}`);
        }
      });
      
      researchRow.appendChild(researchBtn);
      
      content.appendChild(researchRow);
    });
  }
  
  // Ignore the immediate click that triggered opening the menu so it doesn't close instantly
  skipNextClick = true;
}

function closeSpawnMenu(){ const ex = document.getElementById('spawnMenu'); if(ex) ex.remove(); }

// Helper function to check if a location is near an owned port
function isNearOwnedPort(col, row, team) {
  const tiles = [{ col, row }, ...getAdjacentCoords(col, row, true)];
  for (const tile of tiles) {
    const idx = tile.row * COLS + tile.col;
    const settlement = settlements[idx];
    if (settlement && settlement.type === 'PORT' && (settlement.owner === team || settlement.team === team)) {
      return true;
    }
  }
  return false;
}

// Build menu for special constructions like Fortress and Ships
function openBuildMenu(col, row){
  closeSpawnMenu();
  
  // Check if this is near a port (for ship building)
  const nearOwnedPort = isNearOwnedPort(col, row, currentTeam);
  
  const menu = document.createElement('div');
  menu.id = 'spawnMenu';
  menu.style.position = 'fixed';
  menu.style.left = '50%';
  menu.style.top = '50%';
  menu.style.transform = 'translate(-50%, -50%)';
  menu.style.background = 'rgba(6,12,20,0.95)';
  menu.style.color = '#e6eef6';
  menu.style.padding = '8px';
  menu.style.borderRadius = '8px';
  menu.style.zIndex = 9999;
  menu.style.minWidth = '200px';
  const title = document.createElement('div'); title.style.fontWeight='700'; title.style.marginBottom='6px';
  title.textContent = `Build at (${col},${row})`; menu.appendChild(title);

  const list = document.createElement('div'); list.style.display='flex'; list.style.flexDirection='column'; list.style.gap='6px';
  
  // Fortress section
  const fortressSection = document.createElement('div');
  const fortressTitle = document.createElement('div'); 
  fortressTitle.style.fontWeight='600'; fortressTitle.style.marginBottom='4px'; fortressTitle.style.color='#63b3ed';
  fortressTitle.textContent = '🏰 Fortresses'; fortressSection.appendChild(fortressTitle);
  
  const fortressTypes = ['Stockade','Castle','Heavy Fortress'];
  fortressTypes.forEach(ft => {
    const t = UNIT_TEMPLATES[ft] || { hp:150, atkRange:2, dmg:12, cost:3 };
    const info = document.createElement('div');
    
    // Format cost display properly
    let costDisplay;
    if (typeof t.cost === 'object') {
      const parts = [];
      if (t.cost.gold > 0) parts.push(`${t.cost.gold}G`);
      if (t.cost.materials > 0) parts.push(`${t.cost.materials}M`);
      costDisplay = parts.join('/') || '0';
    } else {
      costDisplay = t.cost;
    }
    
    info.innerHTML = `<div style="font-weight:700">${ft}</div><div style="font-size:12px;color:#9aa6b2">HP ${t.hp} • Range ${t.atkRange} • DMG ${t.dmg} • Cost ${costDisplay}</div>`;
    const btn = document.createElement('button'); btn.className='small'; btn.textContent = `Build ${ft} (${costDisplay})`;
    btn.onclick = () => {
      try{
        const team = currentTeam;
        const cost = t.cost;
        
        // Use proper resource checking
        if (!canAfford(team, cost)) { 
          showPopup('Insufficient Resources', 'Not enough resources', 'error'); 
          return; 
        }
        if(getUnitAt(col,row) || terrain[row*COLS+col] || settlements[row*COLS+col]){ 
          showPopup('Tile Unavailable', 'Tile no longer available', 'error'); 
          return; 
        }
        
        deductResources(team, cost);
        const u = makeUnit(ft, team, col, row, { maxHp: t.hp, atkRange: t.atkRange, dmg: t.dmg, cost: cost, justSpawned: true });
        units.push(u);
        closeSpawnMenu(); updateUI(); try{ postGameState(); }catch(e){}
      }catch(e){ console.warn('Failed to build fortress', e); }
    };
    const rowEl = document.createElement('div'); rowEl.style.display='flex'; rowEl.style.justifyContent='space-between'; rowEl.style.alignItems='center';
    rowEl.appendChild(info); rowEl.appendChild(btn); fortressSection.appendChild(rowEl);
  });
  list.appendChild(fortressSection);
  
  // Ship section (only if near owned port and on water)
  const isWater = normalizeTerrainType(terrain[row * COLS + col]) === 'WATER';
  if (nearOwnedPort && isWater) {
    const shipSection = document.createElement('div'); shipSection.style.marginTop='8px';
    const shipTitle = document.createElement('div'); 
    shipTitle.style.fontWeight='600'; shipTitle.style.marginBottom='4px'; shipTitle.style.color='#4fd1c7';
    shipTitle.textContent = '⛵ Ships'; shipSection.appendChild(shipTitle);
    
    const shipTypes = ['Sloop','Man-of-War','Battleship'];
    shipTypes.forEach(st => {
      const t = UNIT_TEMPLATES[st];
      if (t && t.isWaterUnit) {
        const info = document.createElement('div');
        
        // Format cost display properly for ships
        let costDisplay;
        if (typeof t.cost === 'object') {
          const parts = [];
          if (t.cost.gold > 0) parts.push(`${t.cost.gold}G`);
          if (t.cost.materials > 0) parts.push(`${t.cost.materials}M`);
          costDisplay = parts.join('/') || '0';
        } else {
          costDisplay = t.cost + 'M';
        }
        
        info.innerHTML = `<div style="font-weight:700">${st}</div><div style="font-size:12px;color:#9aa6b2">HP ${t.hp} • Range ${t.atkRange} • DMG ${t.dmg} • Cost ${costDisplay}</div>`;
        const btn = document.createElement('button'); btn.className='small'; btn.textContent = `Build ${st} (${costDisplay})`;
        btn.onclick = () => {
          try{
            const team = currentTeam;
            const cost = t.cost;
            
            // Use proper resource checking
            if (!canAfford(team, cost)) { 
              showPopup('Insufficient Resources', 'Not enough resources', 'error'); 
              return; 
            }
            if(getUnitAt(col,row) || settlements[row*COLS+col]){ 
              showPopup('Tile Unavailable', 'Tile no longer available', 'error'); 
              return; 
            }
            
            deductResources(team, cost);
            const u = makeUnit(st, team, col, row, { maxHp: t.hp, atkRange: t.atkRange, dmg: t.dmg, cost: cost, justSpawned: true });
            units.push(u);
            closeSpawnMenu(); updateUI(); try{ postGameState(); }catch(e){}
          }catch(e){ console.warn('Failed to build ship', e); }
        };
        const rowEl = document.createElement('div'); rowEl.style.display='flex'; rowEl.style.justifyContent='space-between'; rowEl.style.alignItems='center';
        rowEl.appendChild(info); rowEl.appendChild(btn); shipSection.appendChild(rowEl);
      }
    });
    list.appendChild(shipSection);
  }
  
  menu.appendChild(list);

  const closeBtn = document.createElement('div'); closeBtn.style.marginTop='8px'; closeBtn.style.textAlign='right';
  const cbtn = document.createElement('button'); cbtn.className='small'; cbtn.textContent='Close'; cbtn.onclick = closeSpawnMenu; closeBtn.appendChild(cbtn);
  menu.appendChild(closeBtn);

  document.body.appendChild(menu);
  // Ignore immediate click that opened the menu
  skipNextClick = true;
}

function spawnUnitAt(name, team, col, row){
  // Prevent rapid-fire unit spawning
  if (!isActionAllowed(col, row)) {
    console.log('Spawn blocked - too soon after last action');
    return;
  }
  
  // Validate tile empty
  if(getUnitAt(col,row)) { showPopup('Tile Occupied', 'Tile occupied', 'error'); return; }
  const t = UNIT_TEMPLATES[name]; if(!t) return;
  
  // Check cost and resources using unified system
  const unitCost = t.cost;
  if (!canAfford(team, unitCost)) {
    showPopup('Insufficient Resources', 'Not enough resources!', 'error');
    return;
  }
  deductResources(team, unitCost);
  
  recordAction(col, row); // Record this as a significant action
  
  // Create unit
  const u = makeUnit(name, team, col, row, { maxHp: t.hp, atkRange: t.atkRange, dmg: t.dmg, cost: unitCost, justSpawned: true });
  units.push(u);
  
  // Record human unit spawn for learning AI
  if (!isAITeam(team)) {
    recordHumanAction('unitSpawn', {
      unitType: name,
      col: col,
      row: row,
      cost: unitCost,
      nearSettlement: getSettlementAt(col, row) ? true : false
    });
  }
  
  // close menu and update UI
  closeSpawnMenu(); updateUI();
  try{ postGameState(); } catch(e){}
  // Inform parent/hub about resources change and spawn (optional)
  try{ if(window.parent) window.parent.postMessage({ type:'resourcesUpdate', team, resources: getResources(team) }, '*'); } catch(e){}
}

// ========================================
