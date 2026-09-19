// Warborn source split from the original game.js.
// Section: js/systems/settlements.js

// Settlement income values
// SETTLEMENT_INCOME removed - now using SETTLEMENTS.income property for consolidation

function computeIncomeForTeam(team){
  if(!settlements) return { food: 0, gold: 0, materials: 0 };
  
  let income = { food: 0, gold: 0, materials: 0 };
  
  // Settlement income
  for(let i=0;i<settlements.length;i++){
    const s = settlements[i];
    if(!s || !s.owner) continue;
    if(s.owner === team){
      const settlementData = SETTLEMENTS[s.type];
      if (settlementData && settlementData.income) {
        // Add all resource types from settlement income
        if (typeof settlementData.income === 'number') {
          // Backward compatibility - old single income value goes to gold
          income.gold += settlementData.income;
        } else {
          // New three-resource income system
          income.food += settlementData.income.food || 0;
          income.gold += settlementData.income.gold || 0;
          income.materials += settlementData.income.materials || 0;
        }
      }
    }
  }
  
  // Farm terrain income (10 food per farm)
  if (terrain) {
    for(let i = 0; i < terrain.length; i++) {
      if (terrain[i] === 'FARM') {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        
        // Check if this team controls this farm (has a unit on it or adjacent settlement)
        const hasUnit = units.some(u => u.team === team && u.row === row && u.col === col);
        const hasAdjacentSettlement = settlements.some(s => 
          s && s.owner === team && 
          Math.abs(s.col - col) <= 1 && Math.abs(s.row - row) <= 1
        );
        
        if (hasUnit || hasAdjacentSettlement) {
          income.food += 10;
        }
      }
    }
  }
  
  return income;
}

// Settlement upgrade function
function upgradeSettlement(col, row, team) {
  const idx = row * COLS + col;
  const settlement = settlements[idx];
  
  if (!settlement || settlement.owner !== team) {
    showPopup('Cannot Upgrade', 'You can only upgrade settlements you own!', 'error');
    return false;
  }
  
  const settlementData = SETTLEMENTS[settlement.type];
  if (!settlementData || !settlementData.upgradeTo) {
    if (settlement.type === 'CITY') {
      showPopup('Maximum Level', 'Cities are already at maximum level!', 'info');
    } else {
      showPopup('Cannot Upgrade', 'This settlement cannot be upgraded!', 'error');
    }
    return false;
  }
  
  const upgradeCost = settlementData.upgradeCost;
  if (!hasResources(team, upgradeCost)) {
    const teamResources = getResources(team);
    const needed = [];
    if (upgradeCost.food > teamResources.food) needed.push(`${upgradeCost.food - teamResources.food} more food`);
    if (upgradeCost.gold > teamResources.gold) needed.push(`${upgradeCost.gold - teamResources.gold} more gold`);
    if (upgradeCost.materials > teamResources.materials) needed.push(`${upgradeCost.materials - teamResources.materials} more materials`);
    showPopup('Insufficient Resources', `Not enough resources to upgrade! Need: ${needed.join(', ')}`, 'error');
    return false;
  }
  
  // Show upgrade confirmation
  const costDisplay = [];
  if (upgradeCost.food > 0) costDisplay.push(`${upgradeCost.food} Food`);
  if (upgradeCost.gold > 0) costDisplay.push(`${upgradeCost.gold} Gold`);
  if (upgradeCost.materials > 0) costDisplay.push(`${upgradeCost.materials} Materials`);
  
  const currentData = SETTLEMENTS[settlement.type];
  const newData = SETTLEMENTS[settlementData.upgradeTo];
  
  const confirmation = confirm(
    `Upgrade ${settlement.type} to ${settlementData.upgradeTo}?\n\n` +
    `Cost: ${costDisplay.join(', ')}\n\n` +
    `Benefits:\n` +
    `• Healing: ${(currentData.healPct * 100).toFixed(1)}% → ${(newData.healPct * 100).toFixed(1)}%\n` +
    `• Defense: ${(currentData.defense * 100).toFixed(0)}% → ${(newData.defense * 100).toFixed(0)}%\n` +
    `• Income: ${formatResourcesDisplay(currentData.income)} → ${formatResourcesDisplay(newData.income)}`
  );
  
  if (!confirmation) return false;
  
  // Perform upgrade
  spendResources(team, upgradeCost);
  settlements[idx] = { type: settlementData.upgradeTo, owner: team };
  
  console.log(`${team} upgraded ${settlement.type} to ${settlementData.upgradeTo} at (${col}, ${row})`);
  updateUI();
  return true;
}

// Helper function to format resource display
function formatResourcesDisplay(resources) {
  if (typeof resources === 'number') return `${resources} Gold`;
  const parts = [];
  if (resources.food > 0) parts.push(`${resources.food}F`);
  if (resources.gold > 0) parts.push(`${resources.gold}G`);
  if (resources.materials > 0) parts.push(`${resources.materials}M`);
  return parts.join('/') || '0';
}

function grantIncomeForTeam(team){
  const inc = computeIncomeForTeam(team);
  
  // Use three-resource system
  addResources(team, inc);
  
  // Food consumption: each unit consumes 1 food per turn (only if farms exist)
  if (typeof resources[team] === 'object' && hasFarmsOnMap()) {
    const teamUnits = units.filter(u => u.team === team && u.hp > 0);
    const foodConsumption = teamUnits.length;
    
    if (resources[team].food >= foodConsumption) {
      resources[team].food -= foodConsumption;
    } else {
      // Starvation: units lose morale when they have no food
      const shortage = foodConsumption - resources[team].food;
      resources[team].food = 0;
      
      // Apply morale penalty to all starving units
      const starvingUnits = teamUnits.slice(0, shortage);
      starvingUnits.forEach(unit => {
        unit.morale = Math.max(0, unit.morale - 10); // Lose 10 morale per turn without food
      });
      
      if (team === 'PLAYER') {
        console.warn(`⚠️ Food shortage! ${shortage} units are losing morale due to hunger.`);
      }
    }
  }
  
  // Notify parent/hub about resource change
  try{ 
    if(window.parent) {
      const resourceAmount = typeof resources[team] === 'object' ? 
        resources[team].gold : resources[team];
      window.parent.postMessage({ type:'resourcesUpdate', team, amount: resourceAmount }, '*');
    }
  } catch(e){}
  
  // Update UI to reflect new resources
  updateUI();
}
