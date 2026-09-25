// Tactical AI: one cancellable turn per faction, shared legal movement rules.
let activeAITurn = null;
function aiHostile(a,b) { return a!==b && !areFriendlyTeams(a,b) && canAttack(a,b); }
function aiDistance(a,b) { return manhattan(a.col,a.row,b.col,b.row); }
function aiAssets(team) {
  return settlements.flatMap((s,i)=>s&&s.owner===team?[{...s,col:i%COLS,row:Math.floor(i/COLS)}]:[]);
}
function aiMobile(team) { return units.filter(u=>u.hp>0&&u.team===team&&!isFortressUnit(u)); }
function aiExpansionMode(team) {
  const value=t=>{const income=computeIncomeForTeam(t);return income.gold+income.materials;};
  return value(team)<=value('PLAYER');
}
function aiGarrisonReplacement(u) {
  const home=settlements[u.row*COLS+u.col];
  if(!home||home.owner!==u.team||aiMobile(u.team).length>=aiAssets(u.team).length*3)return null;
  // Only spend on a legal, already unlocked defender; never rely on future income.
  return allowedUnitsForSettlement(home.type,u.team)
    .filter(n=>UNIT_TEMPLATES[n].dmg>0&&canAfford(u.team,UNIT_TEMPLATES[n].cost))
    .sort((a,b)=>UNIT_TEMPLATES[b].hp*UNIT_TEMPLATES[b].dmg-UNIT_TEMPLATES[a].hp*UNIT_TEMPLATES[a].dmg)[0]||null;
}
function aiThreat(tile,team) {
  return units.filter(e=>e.hp>0&&aiHostile(e.team,team)).reduce((sum,e)=>{
    const d=aiDistance(e,tile), reach=(isFortressUnit(e)?0:e.move)+e.atkRange;
    return sum+(d<=reach ? e.dmg*Math.max(.4,e.hp/e.maxHp)*(d<=e.atkRange?1:.55) : 0);
  },0);
}
function aiCanFire(u,tile) {
  return u.name==='Dragon'||u.name==='Assassin'||terrain[tile.row*COLS+tile.col]!=='SWAMP';
}
function aiProtectedUnit(team) {
  const mission=currentVictoryCondition.type==='KILL_UNIT_LIMIT'&&units.find(u=>u.hp>0&&u.team===team&&u.id===currentVictoryCondition.targetUnitId);
  return mission||units.find(u=>u.hp>0&&u.team===team&&u.name==='Crown');
}
function aiMayLeave(u,tile) {
  if(tile.col===u.col&&tile.row===u.row)return true;
  const home=settlements[u.row*COLS+u.col];
  // Occupied towns keep a defender on the actual tile, even when no enemy is nearby.
  if(home?.owner===u.team)return !!aiGarrisonReplacement(u);
  if(aiProtectedUnit(u.team)===u)return true; // Losing this unit ends the mission.
  // Keep the last garrison in place while an enemy can reach its settlement.
  return aiAssets(u.team).every(s=>{
    if(aiDistance(u,s)>1||aiDistance(tile,s)<=1||aiThreat(s,u.team)<=0)return true;
    const cover=units.filter(v=>v!==u&&v.team===u.team&&v.hp>0&&aiDistance(v,s)<=1);
    return cover.reduce((sum,v)=>sum+v.dmg*Math.max(.4,v.hp/v.maxHp),0)>=aiThreat(s,u.team);
  });
}
function aiTargets(u) {
  return units.filter(e=>e.hp>0&&aiHostile(u.team,e.team)&&aiDistance(u,e)<=u.atkRange)
    .sort((a,b)=>aiAttackValue(u,b)-aiAttackValue(u,a));
}
function aiAttackValue(u,e) {
  const damage=u.dmg*Math.max(.4,u.hp/u.maxHp)*(u.name==='Knight'&&e.name==='Dragon'||u.name==='Assassin'&&e.name==='Crown'?2:1)*(hasCrownAura(u)?1.1:1)*(hasCrownAura(e)?0.75:1);
  return Math.min(damage,e.hp)+(damage>=e.hp?75:0)+(e.name==='Crown'?120:e.name==='Cleric'?25:0)+e.dmg*.5;
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
  if(u.name==='Cleric'||isFortressUnit(u))return [];
  if(u.hp<u.maxHp*0.5)u.aiRecovering=true;
  if(u.hp>=u.maxHp)u.aiRecovering=false;
  return u.aiRecovering?units.filter(a=>a!==u&&a.hp>0&&a.name==='Cleric'&&areFriendlyTeams(a.team,u.team)):[];
}
function aiChoosePosition(u) {
  const enemies=units.filter(e=>e.hp>0&&aiHostile(u.team,e.team));
  const patients=units.filter(a=>a!==u&&a.hp>0&&areFriendlyTeams(a.team,u.team)&&a.hp<a.maxHp);
  const objectives=aiObjectives(u), vip=u.name==='Crown'||aiProtectedUnit(u.team)===u;
  const healers=aiRecoveryClerics(u);
  const escort=units.filter(a=>a!==u&&a.hp>0&&a.team===u.team&&a.name!=='Cleric'&&!isFortressUnit(a));
  // Combat units press every hostile faction, even while ahead economically.
  // Clerics and mission targets retain their protective positioning.
  const aggressive=!vip&&u.name!=='Cleric';
  const captures=objectives.filter(o=>o.capture);
  let best={col:u.col,row:u.row},bestScore=-Infinity;
  for(const tile of aiMoveOptions(u)){
    const threat=aiThreat(tile,u.team),s=settlements[tile.row*COLS+tile.col];
    let score=-threat*(vip?8:u.name==='Cleric'?20:healers.length?5:0.35);
    if(threat>=u.hp)score-=vip?1000:aggressive?60:150;
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
      for(const objective of objectives)score+=objective.weight/(1+aiDistance(tile,objective));
      // Keep advancing toward a settlement even before it is within one move.
      if(captures.length)score-=35*Math.min(...captures.map(o=>aiDistance(tile,o)));
      // Close to attack range instead of waiting for enemies to approach.
      if(enemies.length)score-=24*Math.min(...enemies.map(e=>Math.max(0,aiDistance(tile,e)-u.atkRange)));
      if(!u.hasActed&&aiCanFire(u,tile)){
        const targets=enemies.filter(e=>aiDistance(tile,e)<=u.atkRange);
        if(targets.length)score+=1.8*Math.max(...targets.map(e=>aiAttackValue(u,e)));
      }
    }else{
      for(const home of aiAssets(u.team))score+=20/(1+aiDistance(tile,home));
    }
    if(tile.col===u.col&&tile.row===u.row)score+=1;
    if(score>bestScore){bestScore=score;best=tile;}
  }
  return best;
}
function aiMoveWithGarrison(u,tile) {
  if(u.hasMoved||!canMoveTo(u,tile.col,tile.row)||!aiMayLeave(u,tile))return false;
  const col=u.col,row=u.row,home=settlements[row*COLS+col];
  const replacement=home?.owner===u.team?aiGarrisonReplacement(u):null;
  if(home?.owner===u.team&&!replacement)return false;
  ActionEffects.move(u,tile.col,tile.row);u.col=tile.col;u.row=tile.row;u.hasMoved=true;
  // No await between departure and replacement: the town is never left open for a turn.
  if(replacement){
    deductResources(u.team,UNIT_TEMPLATES[replacement].cost);
    units.push(makeUnit(replacement,u.team,col,row,{justSpawned:true}));
  }
  checkSettlementCaptureAfterMove(u,u.col,u.row);
  return true;
}
function aiHeal(u) {
  if(u.name!=='Cleric'||u.hasActed)return;
  const patients=units.filter(a=>a!==u&&a.hp>0&&a.hp<a.maxHp&&areFriendlyTeams(a.team,u.team)&&aiDistance(u,a)<=u.atkRange);
  if(patients.length){for(const a of patients)healUnit(u,a);u.hasActed=true;}
}
function aiAnchor(u) {
  if(u.isWaterUnit||u.name==='Dragon'||isFortressUnit(u)||getGold(u.team)<6)return;
  const objectives=aiObjectives(u).concat(units.filter(e=>e.hp>0&&aiHostile(u.team,e.team)));
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
  const homes=aiAssets(team), cap=homes.length*3;
  let army=aiMobile(team);
  const emergency=homes.some(s=>aiThreat(s,team)>0);
  // Invest in a city to unlock materials and stronger units.
  if(!emergency&&army.length>=Math.min(2,cap)){
    const home=homes.find(s=>s.type!=='CITY'&&s.type!=='PORT');
    if(home){
      const data=SETTLEMENTS[home.type];
      if(data?.upgradeTo && canAfford(team,data.upgradeCost) && getGold(team)>=data.upgradeCost.gold+4){deductResources(team,data.upgradeCost);settlements[home.row*COLS+home.col].type=data.upgradeTo;home.type=data.upgradeTo;}
    }
  }
  if(army.length>=cap){aiFortify(team,homes);return;}
  const clerics=army.filter(u=>u.name==='Cleric').length;
  const needHealer=clerics<Math.max(1,Math.floor(army.length/5))&&army.length>=2;
  const enemyArmy=units.filter(e=>e.hp>0&&aiHostile(team,e.team));
  const counter=enemyArmy.some(e=>e.name==='Dragon')?'Knight':enemyArmy.some(isFortressUnit)?'Catapult':null;
  const elite=getGold(team)>=30?'Dragon':'Assassin';
  const priorities=[...new Set([...(needHealer?['Cleric']:[]),...(counter?[counter]:[]),elite,'Dragon','Assassin','Knight','Catapult','Archer','Spearman','Cleric'])];
  const available=new Set(homes.flatMap(s=>allowedUnitsForSettlement(s.type)));
  const desired=priorities.find(n=>available.has(n)&&(!hasResearched(team,n)||canAfford(team,UNIT_TEMPLATES[n].cost)));
  if(desired&&!hasResearched(team,desired)){
    if(canResearch(team,desired))researchUnit(team,desired);
    else if(!emergency&&army.length>=2)return; // Save for the planned research.
  }
  for(const home of homes){
    if(aiMobile(team).length>=cap)break;
    if(getUnitAt(home.col,home.row))continue;
    const allowed=allowedUnitsForSettlement(home.type,team).filter(n=>canAfford(team,UNIT_TEMPLATES[n].cost));
    if(!allowed.length)continue;
    let pick=priorities.find(n=>allowed.includes(n)&&!(n==='Cleric'&&aiMobile(team).some(u=>u.name==='Cleric')));
    if(!pick){
      if(!emergency&&army.length>=2&&desired)return; // Preserve savings for quality.
      pick=allowed.sort((a,b)=>UNIT_TEMPLATES[b].hp*UNIT_TEMPLATES[b].dmg-UNIT_TEMPLATES[a].hp*UNIT_TEMPLATES[a].dmg)[0];
    }
    deductResources(team,UNIT_TEMPLATES[pick].cost);
    units.push(makeUnit(pick,team,home.col,home.row,{justSpawned:true}));
  }
}
function aiFortify(team,homes) {
  if(getGold(team)<15)return;
  const home=homes.find(s=>aiThreat(s,team)>0&&!units.some(u=>u.hp>0&&u.team===team&&isFortressUnit(u)&&aiDistance(u,s)<=2));
  if(!home)return;
  const name='Stockade',cost=UNIT_TEMPLATES[name].cost;
  if(!hasResearched(team,name)&&canResearch(team,name))researchUnit(team,name);
  if(!hasResearched(team,name)||!canAfford(team,cost))return;
  const dirs=useHexGrid?getHexNeighbors(home.col,home.row):[[1,0],[-1,0],[0,1],[0,-1]];
  for(const [dc,dr]of dirs){
    const col=home.col+dc,row=home.row+dr;
    if(col<0||col>=COLS||row<0||row>=ROWS||terrain[row*COLS+col]||settlements[row*COLS+col]||getUnitAt(col,row))continue;
    deductResources(team,cost);units.push(makeUnit(name,team,col,row,{justSpawned:true}));break;
  }
}
async function aiTakeTurn(team='AI') {
  if(gameOver||currentTeam!==team||!isAITeam(team))return;
  if(activeAITurn&&activeAITurn.team===team&&activeAITurn.turn===turnNumber)return;
  const token={team,turn:turnNumber};activeAITurn=token;
  const valid=()=>activeAITurn===token&&currentTeam===team&&turnNumber===token.turn&&!gameOver;
  clearTimeout(aiTurnTimeoutId);
  try{
    const army=units.filter(u=>u.team===team&&u.hp>0).sort((a,b)=>(b.name==='Cleric')-(a.name==='Cleric'));
    for(const u of army){
      if(!valid())return;
      if(u.hp<=0||u.morale<=0)continue;
      aiHeal(u);aiAnchor(u);
      if(u.name!=='Cleric'&&!aiRecoveryClerics(u).length&&!u.hasActed&&aiCanFire(u,u)){
        const target=aiTargets(u)[0];if(target)attackUnit(u,target);
      }
      if(u.hp<=0)continue;
      const tile=aiChoosePosition(u);
      if(!u.hasMoved&&(tile.col!==u.col||tile.row!==u.row)&&canMoveTo(u,tile.col,tile.row)){
        aiMoveWithGarrison(u,tile);
      }
      if(typeof Endless!=='undefined'&&Endless.active){Endless.check();if(gameOver)return;}
      aiHeal(u);
      if(u.name!=='Cleric'&&!aiRecoveryClerics(u).length&&!u.hasActed&&aiCanFire(u,u)){const target=aiTargets(u)[0];if(target)attackUnit(u,target);}
      updateUI();checkEndGame();
      await new Promise(resolve=>setTimeout(resolve,180));
    }
    if(valid()){
      // Catch units that retreated into range after their cleric's movement.
      for(const healer of units.filter(u=>u.team===team&&u.hp>0&&u.morale>0))aiHeal(healer);
      aiRecruit(team);updateUI();checkEndGame();
    }
  }finally{
    if(valid()){activeAITurn=null;selectedUnit=null;endTurn(team);}
    else if(activeAITurn===token)activeAITurn=null;
  }
}
