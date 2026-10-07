// Army strength, procurement and territory investment share one priority policy.
function aiMilitary(team) { return aiMobile(team).filter(u=>u.name!=='Crown'); }
function aiStrength(u) { return Math.sqrt(Math.max(1,u.hp)*Math.max(8,u.dmg||0))*(1+Math.max(0,(u.atkRange||1)-1)*.12); }
function aiMilitaryNeeds(team) {
  const own=aiMilitary(team),origins=[...aiAssets(team),...own];
  const rivals=[...new Set(units.filter(u=>u.hp>0&&aiHostile(team,u.team)).map(u=>u.team))];
  const distance=t=>Math.min(Infinity,...[...aiAssets(t),...aiMilitary(t)].flatMap(p=>origins.map(a=>aiDistance(a,p))));
  rivals.sort((a,b)=>distance(a)-distance(b)||a.localeCompare(b));
  const neighbor=rivals[0],power=own.reduce((s,u)=>s+aiStrength(u),0);
  const enemyPower=neighbor?aiMilitary(neighbor).reduce((s,u)=>s+aiStrength(u),0):0;
  return {neighbor,power,defense:Math.max(aiAssets(team).length*35,enemyPower*.9),offense:Math.max(aiAssets(team).length*90,enemyPower*1.25)};
}
function aiRecruitChoice(team,type,combatOnly=false) {
  const army=aiMilitary(team),foes=units.filter(e=>e.hp>0&&aiEnemyUnit(team,e));
  const count=n=>army.filter(u=>u.name===n).length;
  const focus=aiDoctrineFocus(team);
  const heavyUnit=typeof aiPreferredHeavyUnit==='function'?aiPreferredHeavyUnit(team):'Catapult';
  return allowedUnitsForSettlement(type,team).filter(n=>(!combatOnly||UNIT_TEMPLATES[n].dmg>0)&&canAfford(team,getEffectiveUnitCostForTeam(team,n))&&(typeof Territory==='undefined'||Territory.canRecruit(team,n)))
    .map(name=>{
      const stats=getDoctrineUnitStats(team,name),size=Math.max(1,army.length);
      let score=aiStrength({...stats,hp:stats.hp})/(1+count(name)/size);
      if(name==='Cleric')score=army.length>=2&&count(name)<Math.ceil(size/6)?220:0;
      if(name==='Knight'&&foes.some(e=>e.name==='Dragon'))score+=100;
      if(name==='Spearman'&&foes.some(e=>e.name==='Knight'))score+=55;
      if(name==='Dragon')score+=(heavyUnit==='Dragon'?180:-25);
      if(name==='Catapult')score+=(foes.some(isFortressUnit)?100:0)+(heavyUnit==='Catapult'?120:0)+(focus==='engineering'?35:0);
      if(name==='Archer'&&count(name)<size/4)score+=35;
      // Siege upgrades should produce siege armies, with enough melee escorts.
      if(['Archer','Catapult'].includes(name)&&army.filter(u=>u.dmg>0&&u.atkRange===1).length<=army.filter(u=>u.atkRange>1).length)score-=100;
      return {name,score};
    }).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name))[0]?.name||null;
}
function aiBuyAt(team,home) {
  if(getUnitAt(home.col,home.row))return false;
  const name=aiRecruitChoice(team,home.type);if(!name)return false;
  deductResources(team,getEffectiveUnitCostForTeam(team,name));units.push(makeUnit(name,team,home.col,home.row,{justSpawned:true}));return true;
}
function aiSpendResources(team) {
  if(typeof FortressRuins!=='undefined')FortressRuins.aiRepair(team);
  const homes=aiAssets(team).sort((a,b)=>aiThreat(b,team)-aiThreat(a,team));
  // 1. Threatened holdings and a force worth at least 90% of our nearest rival.
  let needs=aiMilitaryNeeds(team);
  for(const h of homes)if(aiThreat(h,team)>0||needs.power<needs.defense){aiBuyAt(team,h);needs=aiMilitaryNeeds(team);}
  // 2. Recruit a coherent offensive force, without a settlement-count cap.
  for(const h of homes)if(aiMilitaryNeeds(team).power<needs.offense||getGold(team)>=20)aiBuyAt(team,h);
  if(aiMilitaryNeeds(team).power<needs.defense&&homes.some(h=>!getUnitAt(h.col,h.row)))return;
  // 3. Use available resources on every useful settlement upgrade.
  for(const h of homes)for(let step=0;step<2;step++){
    const s=settlements[h.row*COLS+h.col];
    if(!SETTLEMENTS[s.type]?.upgradeTo||!purchaseSettlementUpgrade(h.col,h.row,team))break;
  }
  // Upgrades can immediately open a stronger recruitment option.
  for(const h of aiAssets(team))aiBuyAt(team,h);
  // 4. Protect holdings without walling off roads, bridges or narrow passages.
  aiFortify(team,aiAssets(team));aiRecruitNaval(team,aiAssets(team));
}
function aiFortressSite(team,p) {
  const dirs=q=>(useHexGrid?getHexNeighbors(q.col,q.row):[[1,0],[-1,0],[0,1],[0,-1]])
    .map(([dc,dr])=>({col:q.col+dc,row:q.row+dr})).filter(q=>q.col>=0&&q.row>=0&&q.col<COLS&&q.row<ROWS);
  const key=q=>q.row*COLS+q.col;
  if(['WATER','SWAMP','MARSH','VOID'].includes(terrain[key(p)])||settlements[key(p)]||getUnitAt(p.col,p.row))return false;
  if(dirs(p).some(q=>terrain[key(q)]==='BRIDGE'))return false;
  if(units.some(u=>u.hp>0&&isFortressUnit(u)&&aiDistance(u,p)<=2))return false;
  const blocked=new Set(units.filter(u=>u.hp>0&&isFortressUnit(u)).map(key));blocked.add(key(p));
  const pass=q=>!['WATER','VOID'].includes(terrain[key(q)])&&!blocked.has(key(q));
  const exits=dirs(p).filter(pass);if(exits.length<3)return false;
  // Require short alternate routes around the site for every land approach.
  // This rejects chokepoints and accumulating fortress walls, even on hex maps.
  const seen=new Set([key(exits[0])]),queue=[exits[0]];
  for(let i=0;i<queue.length;i++)for(const q of dirs(queue[i]))if(aiDistance(q,p)<=4&&pass(q)&&!seen.has(key(q))){seen.add(key(q));queue.push(q);}
  return exits.every(q=>seen.has(key(q)));
}
function aiFortify(team,homes) {
  for(const home of homes){
    // Two separated strongpoints per holding; stronger technology replaces weak ones.
    const forts=units.filter(u=>u.hp>0&&u.team===team&&isFortressUnit(u)&&aiDistance(u,home)<=3);
    const name=['Heavy Fortress','Castle','Stockade'].find(n=>isUnitUnlocked(team,n)&&canAfford(team,getEffectiveUnitCostForTeam(team,n)));
    if(!name)continue;
    const upgrade=forts.find(u=>UNIT_TEMPLATES[u.name].hp<UNIT_TEMPLATES[name].hp);
    if(upgrade){
      // Rebuild in place for full price; preserve identity and veteran progression.
      const old=UNIT_TEMPLATES[upgrade.name],next=UNIT_TEMPLATES[name];
      deductResources(team,getEffectiveUnitCostForTeam(team,name));upgrade.name=name;upgrade.maxHp+=next.hp-old.hp;upgrade.hp=Math.min(upgrade.maxHp,upgrade.hp+next.hp-old.hp);upgrade.dmg+=next.dmg-old.dmg;upgrade.atkRange=next.atkRange;upgrade.move=0;upgrade.cost=getEffectiveUnitCostForTeam(team,name);continue;
    }
    if(forts.length>=2)continue;
    const sites=[];
    for(let row=Math.max(0,home.row-3);row<=Math.min(ROWS-1,home.row+3);row++)for(let col=Math.max(0,home.col-3);col<=Math.min(COLS-1,home.col+3);col++){
      const p={col,row};if(aiDistance(p,home)>=2&&aiDistance(p,home)<=3&&aiFortressSite(team,p))sites.push(p);
    }
    sites.sort((a,b)=>aiThreat(b,team)-aiThreat(a,team)||aiDistance(a,home)-aiDistance(b,home));
    if(sites[0]){deductResources(team,getEffectiveUnitCostForTeam(team,name));units.push(makeUnit(name,team,sites[0].col,sites[0].row,{justSpawned:true}));}
  }
}
