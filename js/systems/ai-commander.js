// Strategic orders sit above the tactical AI. Only plain data is persisted;
// route fields and legal firing positions live for one planning phase.
const AICommander = (() => {
  let plans = {}, fields = new Map();
  const live = t => units.filter(u=>u.hp>0&&u.team===t);
  const enemy = t => units.filter(u=>u.hp>0&&aiHostile(t,u.team));
  const key = p => p.row*COLS+p.col;
  function neighbors(p) {
    return (useHexGrid?getHexNeighbors(p.col,p.row):[[1,0],[-1,0],[0,1],[0,-1]])
      .map(([x,y])=>({col:p.col+x,row:p.row+y})).filter(p=>p.col>=0&&p.row>=0&&p.col<COLS&&p.row<ROWS);
  }
  function passable(u,p) {
    const t=terrain[key(p)], data=TERRAIN[t];
    if(t==='VOID')return false;
    if(u.name==='Dragon')return true;
    if(['Sloop','Man-of-War','Battleship'].includes(u.name)&&t!=='WATER')return false;
    return !(t==='WATER'&&!u.isWaterUnit)&&!data?.blockedUnits?.includes(u.name)&&!(data?.waterOnly&&!u.isWaterUnit);
  }
  // Reverse Dijkstra, cached by destination and movement profile. Occupied goals
  // mean attack approach; actual movement still goes through canMoveTo.
  function pathCost(u,target,from=u) {
    if(isFortressUnit(u))return aiDistance(from,target)<=u.atkRange?0:Infinity;
    const cacheKey=[u.team,u.name,u.isWaterUnit,u.move,key(target)].join(':');
    if(!fields.has(cacheKey)){
      const dist=new Float64Array(COLS*ROWS).fill(Infinity), heap=[];
      const push=(i,d)=>{let n=heap.length;heap.push([i,d]);while(n){const p=(n-1)>>1;if(heap[p][1]<=d)break;heap[n]=heap[p];n=p;}heap[n]=[i,d];};
      const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let n=0;heap[0]=last;for(;;){let c=n*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[n]=heap[c];n=c;}heap[n]=last;}return first;};
      const blockers=new Set(units.filter(v=>v.hp>0&&v.team!==u.team).map(key));
      const seeds=passable(u,target)?[target]:neighbors(target).filter(p=>passable(u,p)&&aiDistance(p,target)<=u.atkRange);
      for(const p of seeds){dist[key(p)]=0;push(key(p),0);}
      while(heap.length){
        const [i,d]=pop();if(d!==dist[i])continue;
        const p={col:i%COLS,row:Math.floor(i/COLS)};
        for(const q of neighbors(p)){
          const j=key(q);if(!passable(u,q)||(blockers.has(j)&&j!==key(target)))continue;
          const t=terrain[j],dest=terrain[i];
          const cost=u.name==='Crown'?((!t||t==='GRASS')&&(!dest||dest==='GRASS')?1:2):u.name!=='Dragon'&&(t==='MOUNTAIN'||t==='SWAMP'&&u.name!=='Assassin')?Math.max(1,u.move):1;
          if(d+cost<dist[j]){dist[j]=d+cost;push(j,d+cost);}
        }
      }
      // Bound memory on maps with many different targets.
      if(fields.size>=96)fields.delete(fields.keys().next().value);
      fields.set(cacheKey,dist);
    }
    return fields.get(cacheKey)[key(from)]??Infinity;
  }
  function difficulty(previous) {
    const raw=typeof Endless!=='undefined'&&Endless.active?Endless.difficulty:
      typeof campaignMode!=='undefined'?campaignMode?.campaignData?.scenarios?.[campaignMode.currentScenarioIndex]?.difficulty:null;
    return raw==null?(previous?.level??1):/brutal|impossible/i.test(raw)?3:/hard/i.test(raw)?2:/easy/i.test(raw)?0:1;
  }
  function role(u){return u.name==='Crown'?'crown':u.name==='Cleric'?'healer':u.name==='Catapult'?'siege':u.name==='Archer'?'ranged':['Knight','Assassin','Dragon'].includes(u.name)?'raider':'melee';}
  function value(e) {
    return (e.name==='Crown'?220:e.name==='Cleric'?90:e.name==='Catapult'?85:isFortressUnit(e)?65:30)+
      (e.id===currentVictoryCondition.targetUnitId?180:0)+(e.promotionLevel||0)*18+45*(1-e.hp/e.maxHp)+(settlements[key(e)]?35:0);
  }
  function damage(u,e,tile=u) {
    const a={...u,...tile};let d=u.dmg;
    if(terrain[key(a)]==='SWAMP')d*=.5;
    if(hasCrownAura(a))d*=1.1;
    if(u.name==='Assassin'&&e.name==='Crown'||u.name==='Catapult'&&isFortressUnit(e))d*=2;
    d=Math.floor(d*Math.max(.4,u.hp/u.maxHp));
    if(u.name!=='Dragon'){if(u.morale<=30)d=Math.floor(d*.6);else if(u.morale>=120)d=Math.floor(d*1.4);}
    if(u.name==='Knight'&&e.name==='Dragon')d=Math.floor(d*2);
    if(e.name==='Dragon')d=Math.floor(d*(u.name==='Archer'?1.1:u.name==='Catapult'?.5:u.name==='Knight'?1:.8));
    if(e.name==='Spearman'&&units.some(v=>v!==e&&v.hp>0&&v.team===e.team&&v.name==='Spearman'&&aiDistance(v,e)===1))d=Math.floor(d*.7);
    if(u.name==='Assassin'&&TERRAIN[terrain[key(e)]]?.assassinBonus)d*=2;
    if(u.name==='Knight'&&TERRAIN[terrain[key(a)]]?.knightPenalty)d=Math.floor(d*.75);
    if(typeof getDefenseModifiers==='function'&&u.name!=='Catapult')d=Math.floor(d*(1-getDefenseModifiers(a,e)));
    if(typeof getTerrainDamageMultiplier==='function')d=Math.floor(d*getTerrainDamageMultiplier(e));
    if(isFortressUnit(e)&&u.name!=='Catapult')d=Math.floor(d*(1-(getFortressPropsByName(e.name)?.damageReduction||0)));
    if(isFortressUnit(e)&&u.name==='Assassin')d=Math.floor(d*.1);
    if(hasCrownAura(e))d=Math.floor(d*.75);
    if(typeof getDoctrineAttackMultiplier==='function')d=Math.floor(d*getDoctrineAttackMultiplier(a,e));
    return Math.max(0,Math.floor(d));
  }
  // Observe broad force composition and recent losses, without hidden resources.
  function observe(team,old) {
    const foes=enemy(team),homes=aiAssets(team).map(key),previous=old?.observations;
    return {dragons:foes.filter(u=>u.name==='Dragon').length,fortresses:foes.filter(isFortressUnit).length,
      ranged:foes.filter(u=>u.atkRange>1).length,turtling:foes.filter(u=>settlements.some((s,i)=>s?.owner===u.team&&aiDistance(u,{col:i%COLS,row:Math.floor(i/COLS)})<=1)).length,
      raids:Math.min(6,(previous?.raids||0)*.6+(previous?.homes||[]).filter(i=>!homes.includes(i)).length),homes};
  }
  function objectives(team,plan,old) {
    const army=live(team).filter(u=>!isFortressUnit(u)&&u.name!=='Crown'),candidates=[];
    const add=(id,type,target,priority,extra={})=>candidates.push({id,type,target:{col:target.col,row:target.row},priority,...extra});
    for(let i=0;i<settlements.length;i++){
      const s=settlements[i];if(!s)continue;const p={col:i%COLS,row:Math.floor(i/COLS)},threat=aiThreat(p,team);
      if(s.owner===team&&threat>0)add('defend:'+i,'DEFEND',p,250+threat);
      else if(s.owner&&s.owner!==team&&areFriendlyTeams(team,s.owner)&&threat>0)add('ally:'+i,'REINFORCE',p,150+threat);
      else if(s.owner!==team&&(!s.owner||aiHostile(team,s.owner)))add('capture:'+i,threat>90?'SIEGE':'CAPTURE',p,170+(s.type==='CITY'?40:0)+(!s.owner&&plan.style==='ECONOMIC'?75:0)+(plan.style==='AGGRESSIVE'?40:0),{neutral:!s.owner});
    }
    const vip=aiProtectedUnit(team);if(vip)add('guard:'+vip.id,'GUARD',vip,aiThreat(vip,team)>0?400:95,{unitId:vip.id});
    for(const ally of units.filter(u=>u.hp>0&&u.team!==team&&areFriendlyTeams(team,u.team)&&aiThreat(u,team)>0).slice(0,4))add('ally-unit:'+ally.id,'REINFORCE',ally,130+aiThreat(ally,team),{unitId:ally.id});
    const mission=currentVictoryCondition;
    if(['CAPTURE_TOWN','HOLD_TILE'].includes(mission.type)&&Number.isInteger(mission.holdCol)&&Number.isInteger(mission.holdRow)){
      const target={col:mission.holdCol,row:mission.holdRow};
      if(target.col>=0&&target.col<COLS&&target.row>=0&&target.row<ROWS)add('mission-tile','DEFEND',target,260);
    }
    for(const e of enemy(team).sort((a,b)=>value(b)-value(a)).slice(0,8))add('hunt:'+e.id,'HUNT',e,value(e)+(plan.style==='CUNNING'?65:0),{unitId:e.id});
    if(typeof Endless!=='undefined'&&Endless.active&&team==='AI')add('breach','BREACH',{col:Math.floor(COLS/2),row:ROWS-1},280);
    for(const o of candidates){
      const distances=army.map(u=>pathCost(u,o.target)/Math.max(1,u.move));
      o.distance=Math.min(...distances);o.priority-=Math.min(200,o.distance*12);
      if(plan.style==='DEFENSIVE'&&['DEFEND','GUARD'].includes(o.type))o.priority+=65;
      const prior=old?.objectives?.find(p=>p.id===o.id);
      o.stalled=prior&&o.distance>=prior.distance?Math.min(8,(prior.stalled||0)+1):0;
      if(prior&&o.stalled<4)o.priority+=65; // Keep useful orders through several turns.
      if(o.stalled>=4)o.priority-=100;
    }
    return candidates.filter(o=>Number.isFinite(o.distance)).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).slice(0,plan.level===0?1:plan.level===3?4:3);
  }
  function groups(team,plan) {
    const army=live(team).filter(u=>!isFortressUnit(u)),free=new Set(army.map(u=>u.id)),result=[];
    const add=(type,target,priority,objective,chosen)=>{if(!chosen.length)return;chosen.forEach(u=>free.delete(u.id));result.push({type,target,priority,objective,unitIds:chosen.map(u=>u.id)});};
    const homes=aiAssets(team).sort((a,b)=>aiThreat(b,team)-aiThreat(a,team));
    const vip=aiProtectedUnit(team);
    for(const u of army.filter(u=>u.name==='Crown'||u===vip)){
      const safe=homes.slice().sort((a,b)=>aiThreat(a,team)-aiThreat(b,team)||pathCost(u,a)-pathCost(u,b))[0]||u;
      add('GUARD',safe,400,'protect:'+u.id,[u]);
    }
    // A small territorial reserve also guards against fast breakthroughs.
    const fraction=plan.style==='DEFENSIVE'?.32:plan.style==='AGGRESSIVE'?.12:.22;
    let count=homes.length>1||army.length>=7?Math.max(1,Math.floor(army.length*fraction)+Math.min(2,Math.ceil(plan.observations.raids))):0;
    for(const home of homes){
      const chosen=army.filter(u=>free.has(u.id)&&u.dmg>0).sort((a,b)=>pathCost(a,home)-pathCost(b,home)).slice(0,count>0?1:0);
      add('RESERVE',home,200,'reserve:'+key(home),chosen);count-=chosen.length;if(count<=0)break;
    }
    for(const o of plan.objectives){
      const available=army.filter(u=>free.has(u.id)&&Number.isFinite(pathCost(u,o.target))).sort((a,b)=>{
        const bonus=u=>o.type==='SIEGE'&&role(u)==='siege'?-8:o.type==='HUNT'&&role(u)==='raider'?-4:0;
        return pathCost(a,o.target)+bonus(a)-pathCost(b,o.target)-bonus(b);
      });
      const size=o.type==='GUARD'?2:o.type==='DEFEND'?Math.max(2,Math.ceil(available.length*.5)):Math.max(3,Math.ceil(available.length*.65));
      const chosen=available.slice(0,size);
      // Attach support to combat troops rather than leaving it in its own army.
      const healer=available.find(u=>u.name==='Cleric');if(healer&&!chosen.includes(healer)&&chosen.some(u=>u.dmg>0))chosen.push(healer);
      add(o.type,o.target,o.priority,o.id,chosen);
    }
    for(const u of army.filter(u=>free.has(u.id))){
      const group=result.filter(g=>g.type!=='RESERVE'&&Number.isFinite(pathCost(u,g.target))).sort((a,b)=>pathCost(u,a.target)-pathCost(u,b.target))[0];
      if(group)group.unitIds.push(u.id);
    }
    return result;
  }
  function group(u){return plans[u.team]?.groups.find(g=>g.unitIds.includes(u.id));}
  function attackPlan(team,plan) {
    if(plan.level===0)return [];
    const attackers=live(team).filter(u=>u.dmg>0&&!u.hasActed&&u.morale>0&&u.hp>=u.maxHp*.5);
    const options=new Map(attackers.map(u=>[u.id,aiMoveOptions(u)])),used=new Set(),orders=[],occupied=new Set();
    for(const e of enemy(team).sort((a,b)=>value(b)-value(a)).slice(0,plan.level===3?32:plan.level===2?24:10)){
      const choices=[];
      for(const u of attackers){
        if(used.has(u.id))continue;
        const g=group(u);
        const tiles=options.get(u.id).filter(p=>aiDistance(p,e)<=u.atkRange&&!occupied.has(key(p))&&(!g||!['RESERVE','GUARD','DEFEND'].includes(g.type)||aiDistance(p,g.target)<=3));
        tiles.sort((a,b)=>aiThreat(a,team)-aiThreat(b,team)||aiDistance(u,a)-aiDistance(u,b));
        const tile=tiles[0];if(!tile)continue;
        if(aiThreat(tile,team)>u.hp*(plan.style==='AGGRESSIVE'?1.5:1)&&value(e)<200)continue;
        choices.push({unitId:u.id,targetId:e.id,tile,damage:damage(u,e,tile),order:u.name==='Catapult'?0:u.atkRange>1?1:role(u)==='raider'?3:2});
      }
      choices.sort((a,b)=>a.order-b.order||b.damage-a.damage);
      let total=0;const selected=[],slots=new Set();
      for(const c of choices){if(slots.has(key(c.tile))||c.damage<=0)continue;selected.push(c);slots.add(key(c.tile));total+=c.damage;if(total>=e.hp)break;}
      if(total>=e.hp||plan.level>=2&&total>=e.hp*.55){
        for(const c of selected){used.add(c.unitId);occupied.add(key(c.tile));orders.push({...c,kill:total>=e.hp,attackersRequired:selected.length});}
      }
    }
    return orders;
  }
  function economicGoal(team,plan,old) {
    const homes=aiAssets(team),army=aiMobile(team),emergency=homes.some(h=>aiThreat(h,team)>0);
    if(emergency||army.length<2)return null;
    if(old?.economicGoal&&old.economicGoal.type!=='RESEARCH'&&old.economicGoal.age<3)return {...old.economicGoal,age:old.economicGoal.age+1};
    if(old?.economicGoal&&old.economicGoal.type!=='RESEARCH')return null; // Spend this turn before considering another savings goal.
    // Fund unlocked counters with gold/materials. The independent RP goal never
    // competes for this production budget.
    const needed=plan.observations.dragons?'Knight':plan.observations.fortresses?'Catapult':army.some(u=>u.hp<u.maxHp*.7)&&!army.some(u=>u.name==='Cleric')?'Cleric':null;
    if(needed&&isUnitUnlocked(team,needed)&&army.length<homes.length*3&&!army.some(u=>u.name===needed)&&homes.some(h=>allowedUnitsForSettlement(h.type,team).includes(needed)&&!getUnitAt(h.col,h.row))){
      const cost=getEffectiveUnitCostForTeam(team,needed);
      if(!canAfford(team,cost)&&(!cost.materials||computeIncomeForTeam(team).materials>0))return {type:'RECRUIT',unit:needed,targetCost:cost,age:0};
    }
    if(army.length>=homes.length*3)return null;
    const upgrade=homes.find(h=>SETTLEMENTS[h.type]?.upgradeTo);
    if(upgrade&&(plan.style==='ECONOMIC'||!computeIncomeForTeam(team).materials))return {type:'UPGRADE',target:key(upgrade),targetCost:getSettlementUpgradeCost(team,upgrade.type),age:0};
    const names=[plan.observations.dragons?'Knight':null,plan.observations.fortresses||plan.observations.turtling>3?'Catapult':null,!army.some(u=>u.name==='Cleric')?'Cleric':null,plan.style==='CUNNING'?'Assassin':plan.style==='DEFENSIVE'?'Spearman':plan.observations.ranged>3?'Knight':'Dragon'].filter(Boolean);
    const name=names.find(n=>isUnitUnlocked(team,n)&&homes.some(h=>allowedUnitsForSettlement(h.type).includes(n))&&(!(getEffectiveUnitCostForTeam(team,n).materials)||computeIncomeForTeam(team).materials>0));
    if(!name)return null;
    const cost=getEffectiveUnitCostForTeam(team,name);
    return {type:'RECRUIT',unit:name,targetCost:cost,age:0};
  }
  function spend(team) {
    const p=plans[team],goal=p?.economicGoal;if(!goal)return false;
    const homes=aiAssets(team);
    if(homes.some(h=>aiThreat(h,team)>0)){p.economicGoal=null;return false;}
    if(goal.type==='RESEARCH'){
      p.economicGoal=null;return false; // Discard pre-RP saved gold/research goals.
    }
    if(goal.type==='UPGRADE'){
      const s=settlements[goal.target],data=SETTLEMENTS[s?.type];
      if(s?.owner!==team||!data?.upgradeTo){p.economicGoal=null;return false;}
      if(purchaseSettlementUpgrade(goal.target%COLS,Math.floor(goal.target/COLS),team))p.economicGoal=null;return true;
    }
    const home=homes.find(h=>!getUnitAt(h.col,h.row)&&allowedUnitsForSettlement(h.type).includes(goal.unit));
    if(!home||aiMobile(team).length>=homes.length*3){p.economicGoal=null;return false;}
    if(canAfford(team,goal.targetCost)){
      if(!hasResearched(team,goal.unit)){p.economicGoal=null;return false;}
      if(hasResearched(team,goal.unit)&&canAfford(team,getEffectiveUnitCostForTeam(team,goal.unit))){deductResources(team,getEffectiveUnitCostForTeam(team,goal.unit));units.push(makeUnit(goal.unit,team,home.col,home.row,{justSpawned:true}));p.economicGoal=null;}
    }
    return true;
  }
  function build(team) {
    fields.clear();const old=plans[team],raw=diplomacy.personalities?.[team]||'BALANCED';
    const plan={team,turn:turnNumber,level:difficulty(old),style:raw==='TRADER'?'ECONOMIC':raw==='IDEOLOGICAL'?'CUNNING':raw};
    plan.observations=observe(team,old);plan.objectives=objectives(team,plan,old);plan.groups=groups(team,plan);plans[team]=plan;
    plan.attacks=attackPlan(team,plan);plan.economicGoal=economicGoal(team,plan,old);
    plan.researchGoal=chooseAIResearch(team);
    plan.economyRelease=!!old?.economicGoal&&old.economicGoal.age>=3;
    if(api.debug)console.log('AI PLAN',team,JSON.stringify(plan,null,2));return plan;
  }
  function positionScore(u,tile) {
    const g=group(u);if(!g)return 0;
    const cost=pathCost(u,g.target,tile);let score=Number.isFinite(cost)?-22*cost:-10000;
    const mates=live(u.team).filter(a=>a!==u&&g.unitIds.includes(a.id)),front=mates.filter(a=>role(a)==='melee');
    const foes=enemy(u.team),nearest=p=>Math.min(100,...foes.map(e=>aiDistance(p,e)));
    const danger=aiThreat(tile,u.team),risk=plans[u.team]?.style==='AGGRESSIVE'?1.35:1;
    const decisive=foes.some(e=>value(e)>=200&&aiDistance(tile,e)<=u.atkRange&&damage(u,e,tile)>=e.hp);
    if(danger>=u.hp*risk&&!decisive)score-=700;
    if(['ranged','siege','healer','crown'].includes(role(u))){
      if(front.length){score-=12*Math.max(0,Math.min(...front.map(a=>aiDistance(tile,a)))-2);score-=65*Math.max(0,Math.min(...front.map(nearest))+1-nearest(tile));}
      score-=aiThreat(tile,u.team)*(role(u)==='siege'?2:1);
    }
    if(g.type==='RESERVE')score-=60*Math.max(0,aiDistance(tile,g.target)-2);
    // Front-line troops wait for distant escorts before entering a defended siege.
    // Only stage outside contact range, so a unit never waits through a free hit.
    if(g.type==='SIEGE'&&mates.length&&aiDistance(tile,g.target)>u.atkRange){
      const support=mates.filter(a=>['siege','healer','ranged'].includes(role(a)));
      if(support.length)score-=25*Math.max(0,Math.min(...support.map(a=>aiDistance(tile,a)))-3);
    }
    if(role(u)==='melee'){
      const supports=mates.filter(a=>['ranged','siege','healer'].includes(role(a)));
      if(supports.length&&nearest(tile)<=3)score+=Math.max(0,18-6*Math.min(...supports.map(a=>aiDistance(tile,a))));
    }
    if(u.hp<u.maxHp*.5){const retreats=[...aiAssets(u.team),...live(u.team).filter(a=>a.name==='Cleric')];if(retreats.length)score-=45*Math.min(...retreats.map(p=>aiDistance(tile,p)));score-=aiThreat(tile,u.team)*3;}
    if(role(u)==='raider')score+=Math.min(20,Math.max(0,...foes.map(e=>aiDistance(tile,e)<=u.atkRange?value(e)/8:0)));
    return score;
  }
  function order(u){return plans[u.team]?.attacks?.find(a=>a.unitId===u.id&&units.some(e=>e.id===a.targetId&&e.hp>0&&aiHostile(u.team,e.team)));}
  const api={debug:false,build,pathCost,role,value,damage,group,order,positionScore,spend,invalidateRoutes(){fields.clear();},
    get:team=>plans[team],reset(){plans={};fields.clear();},snapshot:()=>JSON.parse(JSON.stringify(plans)),
    restore(data){
      plans={};fields.clear();if(!data||typeof data!=='object')return;
      const point=p=>p&&Number.isInteger(p.col)&&Number.isInteger(p.row)&&p.col>=0&&p.row>=0&&p.col<50&&p.row<50;
      for(const [team,p]of Object.entries(data).slice(0,16)){
        if(!/^AI\d*$/.test(team)||!p||![0,1,2,3].includes(p.level)||!Array.isArray(p.objectives)||!Array.isArray(p.groups)||!Array.isArray(p.attacks))continue;
        if(p.objectives.length>8||p.groups.length>100||p.attacks.length>1000||!p.objectives.every(o=>o&&point(o.target)&&typeof o.id==='string')||!p.groups.every(g=>g&&point(g.target)&&Array.isArray(g.unitIds)&&g.unitIds.length<=1000)||!p.attacks.every(a=>a&&point(a.tile)&&typeof a.unitId==='string'))continue;
        plans[team]=JSON.parse(JSON.stringify(p));
      }
    }};
  return api;
})();
