// Tactical AI: one cancellable turn per faction, shared legal movement rules.
let activeAITurn = null;
function aiEnemyUnit(team,u){return !u.ruins&&(u.rogue||aiHostile(team,u.team));}
function aiHostile(a,b) { return a!==b && !areFriendlyTeams(a,b) && canAttack(a,b); }
function aiDistance(a,b) { return manhattan(a.col,a.row,b.col,b.row); }
function aiAssets(team) {
  return settlements.flatMap((s,i)=>s&&s.owner===team?[{...s,col:i%COLS,row:Math.floor(i/COLS)}]:[]);
}
function aiMobile(team) { return units.filter(u=>u.hp>0&&u.team===team&&!u.rogue&&!u.ruins&&!isFortressUnit(u)); }
function aiExpansionMode(team) {
  const value=t=>{const income=computeIncomeForTeam(t);return income.gold+income.materials;};
  return value(team)<=value('PLAYER');
}
function aiGarrisonReplacement(u) {
  const home=settlements[u.row*COLS+u.col];
  if(!home||home.owner!==u.team)return null;
  return aiRecruitChoice(u.team,home.type,true);
}
function aiThreat(tile,team) {
  return units.filter(e=>e.hp>0&&aiEnemyUnit(team,e)).reduce((sum,e)=>{
    const d=aiDistance(e,tile), reach=(isFortressUnit(e)?0:e.move)+e.atkRange;
    return sum+(d<=reach ? e.dmg*Math.max(.4,e.hp/e.maxHp)*(d<=e.atkRange?1:.55) : 0);
  },0);
}
function aiCanFire(u,tile) {
  return u.name!=='Crown';
}
function aiProtectedUnit(team) {
  const mission=['KILL_UNIT_LIMIT','KILL_CROWN'].includes(currentVictoryCondition.type)&&units.find(u=>u.hp>0&&u.team===team&&u.id===currentVictoryCondition.targetUnitId);
  return mission||units.find(u=>u.hp>0&&u.team===team&&u.name==='Crown');
}
function aiMayLeave(u,tile) {
  if (typeof hyperAggressiveMode !== 'undefined' && hyperAggressiveMode) return true;
  if(tile.col===u.col&&tile.row===u.row)return true;
  const home=settlements[u.row*COLS+u.col];
  // Occupied towns keep a defender on the actual tile, even when no enemy is nearby.
  if(home?.owner===u.team)return !!aiGarrisonReplacement(u)||(typeof Territory!=='undefined'&&!Territory.canRecruit(u.team,'Soldier')&&aiThreat(u,u.team)<=0);
  if(aiProtectedUnit(u.team)===u)return true; // Losing this unit ends the mission.
  // Keep the last garrison in place while an enemy can reach its settlement.
  return aiAssets(u.team).every(s=>{
    if(aiDistance(u,s)>1||aiDistance(tile,s)<=1||aiThreat(s,u.team)<=0)return true;
    const cover=units.filter(v=>v!==u&&v.team===u.team&&v.hp>0&&aiDistance(v,s)<=1);
    return cover.reduce((sum,v)=>sum+v.dmg*Math.max(.4,v.hp/v.maxHp),0)>=aiThreat(s,u.team);
  });
}
function aiTargets(u) {
  return units.filter(e=>e.hp>0&&aiEnemyUnit(u.team,e)&&aiDistance(u,e)<=u.atkRange)
    .sort((a,b)=>aiAttackValue(u,b)-aiAttackValue(u,a)+(isCrusading(u.team)?(b.team===diplomacy.crusades[u.team].target?150:0)-(a.team===diplomacy.crusades[u.team].target?150:0):0));
}
function aiAttackValue(u,e) {
  if(typeof AICommander!=='undefined'&&AICommander.get(u.team)){
    const damage=AICommander.damage(u,e),plan=AICommander.get(u.team);
    return Math.min(damage,e.hp)+(damage>=e.hp?75:0)+AICommander.value(e)*(plan.level===0?.15:.65)+(AICommander.order(u)?.targetId===e.id?180:0);
  }
  const damage=u.dmg*Math.max(.4,u.hp/u.maxHp)*(u.name==='Knight'&&e.name==='Dragon'||u.name==='Assassin'&&e.name==='Crown'||u.name==='Catapult'&&isFortressUnit(e)?2:1)*(hasCrownAura(u)?1.1:1)*(hasCrownAura(e)?0.75:1);
  return Math.min(damage*(terrain[u.row*COLS+u.col]==='SWAMP'?0.5:1),e.hp)+(damage>=e.hp?75:0)+(e.name==='Crown'?120:e.name==='Cleric'?25:0)+e.dmg*.5;
}
function aiMoveOptions(u) {
  const result=[{col:u.col,row:u.row}];
  if(u.hasMoved||isFortressUnit(u))return result;
  for(let row=Math.max(0,u.row-u.move);row<=Math.min(ROWS-1,u.row+u.move);row++)
    for(let col=Math.max(0,u.col-u.move);col<=Math.min(COLS-1,u.col+u.move);col++)
      if((col!==u.col||row!==u.row)&&canMoveTo(u,col,row)&&aiMayLeave(u,{col,row}))result.push({col,row});
  return result;
}
function aiObjectives(u) {
  const group=typeof AICommander!=='undefined'&&AICommander.group(u);
  if(group)return [{...group.target,weight:group.priority,capture:['CAPTURE','SIEGE'].includes(group.type)}];
  const protectedUnit=aiProtectedUnit(u.team);
  const captureWeight=aiExpansionMode(u.team)?320:240;
  const objectives=[];
  if(typeof Endless!=='undefined'&&Endless.active&&u.team==='AI')objectives.push({col:u.col,row:ROWS-1,weight:180});
  for(const s of aiAssets(u.team))if(aiThreat(s,u.team)>0)objectives.push({...s,weight:120});
  // Respond to attacks on allies, with our own garrisons protected by aiMayLeave.
  const allied=units.filter(a=>a.hp>0&&a.team!==u.team&&areFriendlyTeams(u.team,a.team));
  for(const a of allied)if(aiThreat(a,a.team)>0)objectives.push({...a,weight:85});
  for(let i=0;i<settlements.length;i++){
    const s=settlements[i];if(!s)continue;const tile={col:i%COLS,row:Math.floor(i/COLS)};
    if(s.owner&&s.owner!==u.team&&areFriendlyTeams(s.owner,u.team)){
      if(aiThreat(tile,s.owner)>0)objectives.push({...tile,weight:90});
    }else if(s.owner!==u.team&&(!s.owner||aiHostile(u.team,s.owner)))objectives.push({...tile,weight:captureWeight,capture:true});
  }
  if(protectedUnit&&protectedUnit!==u)objectives.push({...protectedUnit,weight:aiThreat(protectedUnit,u.team)>0?150:55});
  return objectives;
}
function aiRecoveryClerics(u) {
  if(u.name==='Cleric'||isFortressUnit(u)||(typeof AICommander!=='undefined'&&AICommander.group(u)?.type==='VANGUARD'))return [];
  if(u.hp<u.maxHp*0.5)u.aiRecovering=true;
  if(u.hp>=u.maxHp)u.aiRecovering=false;
  return u.aiRecovering?units.filter(a=>a!==u&&a.hp>0&&a.name==='Cleric'&&areFriendlyTeams(a.team,u.team)):[];
}
// Free a recruitment tile without sacrificing garrison safety or leaving an empty town.
// The normal move executor purchases the replacement atomically with this move.
function aiCrownDeployment(u) {
  if(u.hasMoved||!aiGarrisonReplacement(u))return null;
  if(u.name!=='Crown'&&getGold(u.team)<20&&aiMilitaryNeeds(u.team).power>=aiMilitaryNeeds(u.team).defense)return null;
  return aiMoveOptions(u).filter(tile=>aiDistance(u,tile)===1&&
    !settlements[tile.row*COLS+tile.col]&&aiThreat(tile,u.team)===0)
    .sort((a,b)=>units.filter(e=>e.hp>0&&aiEnemyUnit(u.team,e)).reduce((score,e)=>
      score+1/(1+aiDistance(a,e))-1/(1+aiDistance(b,e)),0))[0]||null;
}
function aiNearbyCapture(u) {
  if(u.hasMoved||isFortressUnit(u)||u.name==='Crown'||u.name==='Cleric'||u.name==='Assassin'||aiProtectedUnit(u.team)===u)return null;
  const group=typeof AICommander!=='undefined'&&AICommander.group(u);
  if(group&&['GUARD','DEFEND','RESERVE'].includes(group.type)&&aiThreat(group.target,u.team)>0)return null;
  const cost=(p,from=u)=>typeof AICommander!=='undefined'?AICommander.pathCost(u,p,from):aiDistance(from,p);
  const goals=settlements.flatMap((s,i)=>s&&s.owner!==u.team&&(!s.owner||aiHostile(u.team,s.owner))?[{col:i%COLS,row:Math.floor(i/COLS)}]:[])
    .filter(p=>!getUnitAt(p.col,p.row)&&(typeof AICommander==='undefined'||AICommander.canEnter(u,p))&&aiDistance(u,p)<=Math.max(3,u.move*2)&&Number.isFinite(cost(p))).sort((a,b)=>cost(a)-cost(b));
  const options=aiMoveOptions(u);
  for(const goal of goals){
    const best=options.filter(p=>cost(goal,p)<cost(goal)&&aiThreat(p,u.team)<u.hp)
      .sort((a,b)=>cost(goal,a)-cost(goal,b)||aiThreat(a,u.team)-aiThreat(b,u.team))[0];
    if(best)return best;
  }
  return null;
}
function aiChoosePosition(u) {
  const territoryOwners=typeof Territory!=='undefined'?Territory.ownership():null;
  const capture=aiNearbyCapture(u);if(capture)return capture;
  const deployment=aiCrownDeployment(u);
  if(deployment)return deployment;
  const group=typeof AICommander!=='undefined'&&AICommander.group(u);
  const order=typeof AICommander!=='undefined'&&AICommander.order(u);
  const enemies=units.filter(e=>e.hp>0&&aiEnemyUnit(u.team,e));
  const patients=units.filter(a=>a!==u&&a.hp>0&&areFriendlyTeams(a.team,u.team)&&a.hp<a.maxHp);
  const objectives=aiObjectives(u), vip=u.name==='Crown'||aiProtectedUnit(u.team)===u;
  const healers=aiRecoveryClerics(u);
  const escort=units.filter(a=>a!==u&&a.hp>0&&a.team===u.team&&a.name!=='Cleric'&&!isFortressUnit(a));
  // Combat units press every hostile faction, even while ahead economically.
  // Clerics and mission targets retain their protective positioning.
  const aggressive=(typeof hyperAggressiveMode!=='undefined'&&hyperAggressiveMode)||(!vip&&u.name!=='Cleric'),brave=group?.type==='VANGUARD'||(typeof hyperAggressiveMode!=='undefined'&&hyperAggressiveMode);
  const captures=objectives.filter(o=>o.capture);
  let best={col:u.col,row:u.row},bestScore=-Infinity;
  for(const tile of aiMoveOptions(u)){
    const threat=aiThreat(tile,u.team),s=settlements[tile.row*COLS+tile.col];
    let score=-threat*(brave?.05:vip?8:u.name==='Cleric'?20:healers.length?5:0.35);
    if(threat>=u.hp&&!brave)score-=vip?1000:aggressive?60:150;
    if(s&&s.owner===u.team)score+=u.hp<u.maxHp?25:5;
    const allies=units.filter(a=>a!==u&&a.hp>0&&a.team===u.team&&aiDistance(a,tile)<=2);
    score+=Math.min(12,allies.length*3);
    if(u.name==='Cleric'){
      // Support the formation from behind; wounded units come back to us.
      if(escort.length)score-=12*Math.min(...escort.map(a=>Math.max(0,aiDistance(tile,a)-u.atkRange)));
      if(enemies.length&&escort.length){
        const enemyDistance=p=>Math.min(...enemies.map(e=>aiDistance(p,e)));
        const front=Math.min(...escort.map(enemyDistance));
        score-=45*Math.max(0,front+1-enemyDistance(tile));
      }
      for(const a of patients)if(aiDistance(tile,a)<=u.atkRange)score+=Math.min(20,a.maxHp-a.hp)*2;
    }else if(healers.length){
      const distance=Math.min(...healers.map(a=>Math.max(0,aiDistance(tile,a)-a.atkRange)));
      score-=80*distance;
      if(distance===0)score+=100;
    }else if(!vip){
      if(!group)for(const objective of objectives)score+=objective.weight/(1+aiDistance(tile,objective));
      // Keep advancing toward a settlement even before it is within one move.
      if(!group&&captures.length)score-=35*Math.min(...captures.map(o=>aiDistance(tile,o)));
      // Close to attack range instead of waiting for enemies to approach.
      if(!group&&enemies.length)score-=24*Math.min(...enemies.map(e=>Math.max(0,aiDistance(tile,e)-u.atkRange)));
      if(!u.hasActed&&aiCanFire(u,tile)){
        const targets=enemies.filter(e=>aiDistance(tile,e)<=u.atkRange);
        if(targets.length)score+=1.8*Math.max(...targets.map(e=>aiAttackValue(u,e)));
      }
    }else{
      for(const home of aiAssets(u.team))score+=20/(1+aiDistance(tile,home));
    }
    if(typeof Territory!=='undefined'&&Territory.eligible(u)&&territoryOwners[tile.row*COLS+tile.col]!==u.team)score+=12*Territory.value(terrain[tile.row*COLS+tile.col]);
    if(group)score+=AICommander.positionScore(u,tile);
    if(order&&!u.hasActed&&order.tile.col===tile.col&&order.tile.row===tile.row)score+=600;
    if(tile.col===u.col&&tile.row===u.row)score+=1;
    if(score>bestScore){bestScore=score;best=tile;}
  }
  return best;
}
function aiMoveWithGarrison(u,tile) {
  if(u.hasMoved||!canMoveTo(u,tile.col,tile.row)||!aiMayLeave(u,tile))return false;
  const col=u.col,row=u.row,home=settlements[row*COLS+col];
  const replacement=home?.owner===u.team?aiGarrisonReplacement(u):null;
  if(home?.owner===u.team&&!replacement&&!aiMayLeave(u,tile))return false;
  ActionEffects.move(u,tile.col,tile.row);u.col=tile.col;u.row=tile.row;u.hasMoved=true;if(u.name==='Catapult')u.hasActed=true;
  // No await between departure and replacement: the town is never left open for a turn.
  if(replacement){
    deductResources(u.team,getEffectiveUnitCostForTeam(u.team,replacement));
    units.push(makeUnit(replacement,u.team,col,row,{justSpawned:true}));
  }
  checkSettlementCaptureAfterMove(u,u.col,u.row);
  if(typeof AICommander!=='undefined')AICommander.invalidateRoutes();
  return true;
}
function aiHeal(u) {
  if(u.name!=='Cleric'||u.hasActed)return;
  const patients=units.filter(a=>a!==u&&a.hp>0&&a.hp<a.maxHp&&areFriendlyTeams(a.team,u.team)&&aiDistance(u,a)<=u.atkRange);
  if(patients.length){for(const a of patients)healUnit(u,a);u.hasActed=true;}
}
function aiAnchor(u) {
  if(u.isWaterUnit||u.name==='Dragon'||isFortressUnit(u)||getGold(u.team)<6)return;
  const objectives=aiObjectives(u).concat(units.filter(e=>e.hp>0&&aiEnemyUnit(u.team,e)));
  if(!objectives.length)return;
  const oldBest=Math.min(...objectives.map(o=>aiDistance(u,o)));
  const dirs=useHexGrid?getHexNeighbors(u.col,u.row):[[1,0],[-1,0],[0,1],[0,-1]];
  const needed=dirs.some(([dc,dr])=>{
    const col=u.col+dc,row=u.row+dr;
    return col>=0&&col<COLS&&row>=0&&row<ROWS&&terrain[row*COLS+col]==='WATER'&&!getUnitAt(col,row)&&
      Math.min(...objectives.map(o=>aiDistance({col,row},o)))<oldBest;
  });
  if(needed){deductResources(u.team,{gold:2});u.isWaterUnit=true;}
}
function aiRecruit(team) {
  aiSpendResources(team);
  // 5. Research uses its own RP budget and keeps its chosen branch across turns.
  const research=chooseAIResearch(team);
  if(research&&canResearchTech(team,research))researchTech(team,research);
  if(!activeResearch[team]){const next=chooseAIResearch(team);if(next)startDoctrineResearch(team,next);}
}
function aiRecruitNaval(team,homes) {
  const navalThreat=units.some(u=>u.hp>0&&aiHostile(team,u.team)&&UNIT_TEMPLATES[u.name]?.isWaterUnit);
  if(!navalThreat&&terrain.filter(t=>t==='WATER').length<terrain.length*.25)return false;
  const name=['Battleship','Man-of-War','Sloop'].find(n=>isUnitUnlocked(team,n)&&canAfford(team,getEffectiveUnitCostForTeam(team,n))&&(typeof Territory==='undefined'||Territory.canRecruit(team,n)));
  if(!name)return false;
  for(const port of homes.filter(h=>h.type==='PORT')){
    const dirs=useHexGrid?getHexNeighbors(port.col,port.row):[[1,0],[-1,0],[0,1],[0,-1]];
    for(const [dc,dr]of dirs){
      const col=port.col+dc,row=port.row+dr;
      if(col<0||row<0||col>=COLS||row>=ROWS||terrain[row*COLS+col]!=='WATER'||getUnitAt(col,row)||settlements[row*COLS+col])continue;
      deductResources(team,getEffectiveUnitCostForTeam(team,name));units.push(makeUnit(name,team,col,row,{justSpawned:true}));return true;
    }
  }
  return false;
}
async function aiTakeTurn(team='AI') {
  if(gameOver||currentTeam!==team||!isAITeam(team)||(typeof OnlineMatch!=='undefined'&&OnlineMatch.active&&!OnlineMatch.canRunAI()))return;
  if(activeAITurn&&activeAITurn.team===team&&activeAITurn.turn===turnNumber)return;
  if(typeof isNationEliminated==='function'&&isNationEliminated(team))return;
  if(typeof updateCrusade==='function')updateCrusade(team);
  const token={team,turn:turnNumber};activeAITurn=token;
  const valid=()=>activeAITurn===token&&currentTeam===team&&turnNumber===token.turn&&!gameOver&&!(typeof watchGameMode!=='undefined'&&watchGameMode&&watchGamePaused)&&(typeof OnlineMatch==='undefined'||!OnlineMatch.active||OnlineMatch.canRunAI());
  clearTimeout(aiTurnTimeoutId);
  try{
    // Plan once under the same host authority and cancellation token as tactics.
    const plan=typeof AICommander!=='undefined'?AICommander.build(team):null;
    const orderIndex=u=>{const i=plan?.attacks.findIndex(a=>a.unitId===u.id);return i>=0?i:1000+(u.name==='Cleric'?0:1);};
    const army=units.filter(u=>u.team===team&&u.hp>0&&!u.rogue&&!u.ruins).sort((a,b)=>plan?orderIndex(a)-orderIndex(b):(b.name==='Cleric')-(a.name==='Cleric'));
    for(const u of army){
      if(!valid())return;
      if(u.hp<=0||u.morale<=0)continue;
      aiHeal(u);aiAnchor(u);
      if(u.name!=='Cleric'&&!aiRecoveryClerics(u).length&&!u.hasActed&&aiCanFire(u,u)){
        const order=typeof AICommander!=='undefined'&&AICommander.order(u);
        const target=aiTargets(u).find(e=>!order||e.id===order.targetId);if(target){attackUnit(u,target);if(target.hp<=0&&plan)AICommander.invalidateRoutes();}
      }
      if(u.hp<=0)continue;
      const tile=aiChoosePosition(u);
      if(!u.hasMoved&&(tile.col!==u.col||tile.row!==u.row)&&canMoveTo(u,tile.col,tile.row)){
        aiMoveWithGarrison(u,tile);
      }
      if(typeof Endless!=='undefined'&&Endless.active){Endless.check();if(gameOver)return;}
      aiHeal(u);
      if(u.name!=='Cleric'&&!aiRecoveryClerics(u).length&&!u.hasActed&&aiCanFire(u,u)){const target=aiTargets(u)[0];if(target){attackUnit(u,target);if(target.hp<=0&&plan)AICommander.invalidateRoutes();}}
      if(u.name==='Knight'&&u.hp>0&&!u.hasActed&&u.usedBonusAttack){const extra=aiTargets(u)[0];if(extra)attackUnit(u,extra);}
      updateUI();checkEndGame();
      await new Promise(resolve=>setTimeout(resolve,typeof watchGameMode!=='undefined'&&watchGameMode?Math.max(0,watchGameDelay):180));
    }
    if(valid()){
      // Catch units that retreated into range after their cleric's movement.
      for(const healer of units.filter(u=>u.team===team&&u.hp>0&&u.morale>0&&!u.rogue&&!u.ruins))aiHeal(healer);
      aiRecruit(team);updateUI();checkEndGame();
    }
  }finally{
    if(typeof OnlineMatch!=='undefined'&&OnlineMatch.playing)postGameState();
    if(valid()){activeAITurn=null;selectedUnit=null;endTurn(team);}
    else if(activeAITurn===token)activeAITurn=null;
  }
}
