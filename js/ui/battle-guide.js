// Contextual field training, reference manual and battle information.
const BattleGuide = (() => {
 const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key='warborn.field-training.v1',names={HAMLET:'Village',VILLAGE:'Town',CITY:'City',PORT:'Port'};
 const terrainNotes={GRASS:'Open grassland. Normal movement and no terrain defense bonus.',WOODS:'Forest: 30% defense. Knights attack from here at 75% damage. Assassins deal double damage to targets hiding here.',MOUNTAIN:'Mountains: 30% defense, or 50% against Knights. Rough ground limits many marching units.',SWAMP:'Marsh: 10% defense. ALL attacks made from here deal half damage. Knights and Catapults cannot enter. Assassins deal double damage to targets here before other modifiers.',DESERT:'Desert: −10% defense and 10 damage at the end of the occupying unit’s turn. Seek safer ground.',WATER:'Water: −5% defense. Ordinary land units cannot cross. Anchor eligible units first, use a bridge, or fly with a Dragon. Naval units travel on water.',BRIDGE:'Bridge: a land crossing over water. It gives −10% defense, plus a further 10% incoming damage multiplier.',FOUNTAIN:'Fountain: 20% defense and heals 6 HP each turn.',FARM:'Farmland: 5% defense. Settlement ownership, rather than terrain alone, supplies your treasury.',VOID:'Outside the battlefield. Units cannot enter.'};
 let steps=[],step=0,training=false,seen=false,inspected=null,lastTurn='',lastTeam=null,lastResources={},toastTimer=null,savedCamera=null,inspectionSignature='',incomeReceipt=null;
 try{seen=localStorage.getItem(key)==='done';}catch{}
 const local=()=>typeof OnlineMatch!=='undefined'&&OnlineMatch.playing?OnlineMatch.localTeam:'PLAYER';
 const teamName=t=>!t?'Neutral':typeof OnlineMatch!=='undefined'&&OnlineMatch.playing?OnlineMatch.playerName(t):getTeamDisplayName(t);
 const asset=n=>DEFAULT_IMAGE_MAP[n]||null;
 const icon=(n,label)=>asset(n)?`<span class="matchup"><img src="${asset(n)}" alt="${esc(n)}">${esc(label)}</span>`:`<span class="matchup">${esc(n)}: ${esc(label)}</span>`;
 function abilities(u){
  const list={Soldier:'An inexpensive infantry soldier. No unique combat modifier.',Spearman:'Adjacent allied Spearmen reduce damage received by a defending Spearman by 30%.',Archer:'Ranged attacks from two tiles away.',Swordsman:'Durable frontline infantry. No unique combat modifier.',Assassin:'A hit shatters a non-Assassin enemy’s morale, except Dragons. Heals 5 HP on its turn. Deals double damage to targets in forests or marshes.',Knight:'Can make a bonus attack. Deals double damage to Dragons; attacks from forest deal 25% less damage.',Catapult:'Deals double damage to fortresses and ignores their damage reduction and settlement defense.',Dragon:'Flies across terrain, including water. Morale stays at 150 and cannot be shattered. Resists most incoming attacks.',Cleric:'Heals friendly units within range instead of attacking. Keep this healer behind your front line.',Crown:'Cannot attack or be purchased. Adjacent friendly units gain 25% defense and 10% attack. Moves 2 on grassland, 1 elsewhere. Losing your Crown defeats your kingdom; an AI Crown’s death shatters its non-Dragon army.'};
  if(isFortressUnit(u)){const d=getFortressPropsByName(u.name);return `Immovable, even after promotion. Retaliates when attacked within at least 2 tiles. Reduces incoming non-Catapult damage by ${Math.round((d?.damageReduction||0)*100)}%; heals ${d?.healPerTurn||0} HP per turn.`;}
  return list[u.name]||(u.isWaterUnit?'Naval unit: moves on water.':'No unique combat modifier.');
 }
 function matchups(u){
  const out=[];
  if(u.name==='Knight')out.push(icon('Dragon','Attack ×2'));
  if(u.name==='Archer')out.push(icon('Dragon','Attack ×1.1'));
  if(u.name==='Catapult')out.push(...['Stockade','Castle','Heavy Fortress'].map(n=>icon(n,'Attack ×2; ignores armor')),icon('Dragon','Attack ×0.5'));
  if(u.name==='Assassin')out.push(icon('Crown','Attack ×2'),icon('Assassin','Immune to your instant morale shatter'),icon('Dragon','Immune to morale shatter; takes 20% less damage'));
  if(u.name==='Crown')out.push(icon('Assassin','Takes ×2 damage'));
  if(u.name==='Dragon')out.push(icon('Knight','Takes ×2 damage'),icon('Archer','Takes ×1.1 damage'),icon('Catapult','Takes ×0.5 damage'));
  if(isFortressUnit(u))out.push(icon('Catapult','Takes ×2 damage; armor ignored'));
  if(!['Dragon','Crown','Cleric','Assassin'].includes(u.name))out.push(icon('Assassin','A hit shatters morale'));
  if(!['Knight','Archer','Catapult','Cleric','Crown','Assassin','Dragon'].includes(u.name))out.push(icon('Dragon','Your attacks deal 20% less damage'));
  return out.join('')||'<span>No unit-specific damage bonus.</span>';
 }
 function stats(u){
  const cost=typeof u.cost==='object'?u.cost:{gold:u.cost||0,materials:0};
  return `<div class="stat-grid"><span title="Owner">🚩 ${esc(teamName(u.team))}</span><span title="Movement">👣 ${u.move}</span><span title="Attack range">🎯 ${u.atkRange}</span><span title="Damage">⚔️ ${u.dmg}</span><span title="Gold cost">💰 ${cost.gold||0}</span><span title="Material cost">⚒️ ${cost.materials||0}</span><span title="Experience">⭐ ${u.experience||0}</span><span title="Health">❤️ ${u.hp}/${u.maxHp}</span><span title="Morale">🔥 ${u.morale} · ${esc(moraleLabel(u))}</span></div>`;
 }
 function unitDetails(u){return `${stats(u)}<p class="unit-ability">${esc(abilities(u))}</p><div class="matchups">${matchups(u)}</div>${settlements[u.row*COLS+u.col]?.owner===u.team?'<p class="settlement-hint">🏘️ Select this unit, then click it again to open its settlement menu.</p>':''}`;}
 function inspect(c,r){inspected={col:c,row:r};renderInspection();}
 function renderInspection(){
  const el=$('objectInspector');if(!el||!inspected)return;
  const {col:c,row:r}=inspected;if(c>=COLS||r>=ROWS){el.hidden=true;return;}
  const u=units.find(u=>u.hp>0&&u.col===c&&u.row===r),s=settlements[r*COLS+c],t=terrain[r*COLS+c]||'GRASS';
  let html=`<button id="inspectorClose" aria-label="Close tile details">×</button><h3>${esc(u?.name||names[s?.type]|| (t==='WOODS'?'Forest':t==='SWAMP'?'Marsh':t.toLowerCase()))}</h3>`;
  if(u)html+=unitDetails(u);
  if(s){const d=SETTLEMENTS[s.type],next=SETTLEMENTS[d.upgradeTo];html+=`<h4>${names[s.type]} · ${esc(teamName(s.owner))}</h4><p>Each turn: 💰 ${d.income.gold} · ⚒️ ${d.income.materials}. Defense +${Math.round(d.defense*100)}%; healing ${Math.round(d.healPct*100)}%.</p>${next?`<p>Upgrade → ${names[d.upgradeTo]}: +💰 ${next.income.gold-d.income.gold}, +⚒️ ${next.income.materials-d.income.materials} per turn. Cost 💰 ${d.upgradeCost.gold} · ⚒️ ${d.upgradeCost.materials}.</p>`:''}`;}
  html+=`<p class="terrain-note">${esc(terrainNotes[t]||terrainNotes.GRASS)}</p>`;
  if(html===inspectionSignature&&!el.hidden)return;inspectionSignature=html;
  el.innerHTML=html;el.hidden=false;$('inspectorClose').onclick=()=>{inspected=null;el.hidden=true;layout();};layout();
 }
 function targetFor(test){const u=units.find(test);return u?{col:u.col,row:u.row}:null;}
 function tileFor(test){const i=terrain.findIndex((t,i)=>test(t||'GRASS',settlements[i],i));return i<0?null:{col:i%COLS,row:Math.floor(i/COLS)};}
 function lessons(){
  const mine=local(),army=units.filter(u=>u.hp>0&&u.team===mine),allies=getActiveTeams().filter(t=>t!==mine&&areFriendlyTeams(mine,t));
  const scenario=campaignMode.active?campaignMode.campaignData?.scenarios[campaignMode.currentScenarioIndex]:null;
  const goal=typeof Endless!=='undefined'&&Endless.active?'Hold the advancing front. Any enemy reaching the red back row defeats us.':getVictoryConditionLabel(currentVictoryCondition);
  const list=[
   ['Your battlefield',`I’m Captain Garran. I’ll show you how to command here${scenario?.name?' in '+scenario.name:''}. ${scenario?.description||''} We have ${army.length} ${army.length===1?'unit':'units'} on a ${COLS} by ${ROWS} battlefield.`,targetFor(u=>u.team===mine)],
   ['The mission',`First, know what wins this battle: ${goal} ${scenario?.briefing||''} Do not spend lives chasing enemies the mission does not require.`,currentVictoryCondition.holdCol>=0?{col:currentVictoryCondition.holdCol,row:currentVictoryCondition.holdRow}:targetFor(u=>u.id===currentVictoryCondition.targetUnitId)],
   ['Friends and foes',`Our banner belongs to ${teamName(mine)}. ${allies.length?'Our allies are '+allies.map(teamName).join(', ')+'. We cannot attack them or take their towns.':'The other kingdoms here are our rivals. Check their banner before you strike.'}`,targetFor(u=>u.team!==mine)],
   ['Select a warrior','Click one of your units. Its movement and attack opportunities appear on the map. The sidebar shows its strengths, weaknesses and special abilities.',targetFor(u=>u.team===mine)],
   ['Move with purpose','Choose a reachable tile to march there. We can pass through friendly troops, but cannot finish on an occupied tile or march through enemies. Watch the path—not just the destination.',targetFor(u=>u.team===mine)],
   ['Strike at the right moment','Select a ready warrior, then an enemy in range. Most troops act once per turn; Knights can make a bonus attack. Injured troops deal less damage, so protect your veterans.',targetFor(u=>u.team!==mine&&!areFriendlyTeams(mine,u.team))],
   ['Read your strength','These marks are your field ledger: 🚩 owner, 👣 movement, 🎯 range, ⚔️ damage, 💰 gold cost, ⚒️ material cost, ⭐ experience, ❤️ health and 🔥 morale. Hover a symbol for its meaning.',targetFor(u=>u.team===mine)],
   ['Morale wins battles','Morale is courage. At 30 or less, ordinary troops deal reduced damage; at 120 or more, they hit harder. Shattered troops cannot fight normally and may flee. Dragons keep maximum morale. An Assassin can shatter a foe with one hit.',targetFor(u=>u.team===mine)],
   ['Keep your veterans alive','Combat earns experience. Enough experience promotes a warrior, improving health and damage, and sometimes movement. Fortresses never gain movement. Pull wounded veterans back instead of sacrificing them.',targetFor(u=>u.team===mine)],
   ['Healing and support','Clerics heal our troops rather than attacking. Select a Cleric, then a wounded friend in range. Settlements and fountains also restore health. Leave a guard between your healer and the enemy.',targetFor(u=>u.name==='Cleric')],
   ['The royal Crown','If your army has a Crown, protect her. She cannot attack or be bought. Friends beside her gain 25% defense and 10% attack. Assassins deal double damage to her. Her loss can end your kingdom.',targetFor(u=>u.name==='Crown'&&u.team===mine)],
   ['A foothold and a treasury','Villages are small, towns are larger, and cities tower above them. Capture neutral or hostile settlements by occupying them. Allied settlements remain allied. Holdings pay gold; cities also pay materials.',tileFor((t,s)=>!!s)],
   ['Open an occupied settlement','Click your settlement to open recruitment, research and upgrades. If a unit is standing there, select the unit and click it again. Recruitment needs an empty tile, but you can still research or upgrade while it is occupied.',tileFor((t,s)=>s?.owner===mine)],
   ['Research, recruit, improve','We begin with zero resources. Earn income from holdings, research the troops you need, and pay their recruitment cost. The upgrade tab shows exactly how much extra gold and materials a stronger settlement earns each turn.',tileFor((t,s)=>s?.owner===mine)],
  ];
  for(const [t,label] of [['GRASS','Open ground'],['WOODS','Forest cover'],['SWAMP','Dangerous marsh'],['MOUNTAIN','The high ground'],['DESERT','Desert attrition'],['WATER','Crossing water'],['BRIDGE','Hold the crossing'],['FOUNTAIN','Healing springs'],['FARM','Farmland']]){
   const pos=tileFor(v=>v===t);if(pos)list.push([label,`Look at the marked ground. ${terrainNotes[t]} Choose your route with that in mind.`,pos]);
  }
  list.push(['Anchor before you sail','Ordinary land troops need the anchor upgrade before entering water. Select an eligible unit and use ⚓ when you can pay 2 gold. Dragons already fly; fortresses stay planted.',targetFor(u=>u.team===mine)],['Build a stronghold','Fortresses guard a fixed position and never march, even when promoted. Select a warrior to reveal the build control. Keep siege weapons covered: Catapults are the answer to enemy castles.',targetFor(u=>isFortressUnit(u))],['Diplomacy and allies','In ordinary AI battles, open Diplomacy to review relations and negotiate trades of resources, troops and settlements. An ally’s towns are protected from capture. In co-op, your fellow commanders remain allied.']);
  list.push(['Know your matchups','Knights punish Dragons. Catapults break fortresses but struggle against Dragons. Assassins punish troops in forests and marshes. Every unit’s sidebar lists the relevant matchups beside portraits.',targetFor(u=>u.team===mine)]);
  if(typeof Endless!=='undefined'&&Endless.active)list.push(['The moving front','After every full round, the back row vanishes and fresh enemies arrive at the front. Any of our troops left on the vanishing row are lost. Capture incoming towns to keep recruiting. In co-op, protect the whole allied front.',{col:Math.floor(COLS/2),row:ROWS-1}]);
  list.push(['Pass the command','Finish your moves, attacks and spending before End Turn. Income is paid when your turn ends; a brief receipt shows the gain. The upper banner names the next commander. Online, wait for your own turn.'],['Survey the field','Drag the map to pan and use the wheel to zoom toward the pointer. Settlement menus stop map zoom. Click any unit, ground tile or settlement for the field report at bottom right.'],['Your command now','You’re ready. The ? button opens my full field manual, and you can replay this tour whenever you need. Guard your Crown, keep a reserve, and make every march count.']);
  return list;
 }
 function showStep(){
  const [title,text,pos]=steps[step];$('guideTitle').textContent=`Captain Garran · ${title}`;$('guideText').textContent=text;$('guideProgress').textContent=`${step+1} / ${steps.length}`;$('guidePrevious').disabled=step===0;$('guideNext').textContent=step===steps.length-1?'Take command':'Next →';
  if(pos&&Number.isFinite(pos.col)&&Number.isFinite(pos.row)){const p=getTileCenterLocal(pos.col,pos.row),v=getBattleViewport(),o=getMapOrigin();targetPanX=panX=(v.left+v.right)/2-o.x-p.x*zoomLevel;targetPanY=panY=(v.top+v.bottom)/2-o.y-p.y*zoomLevel;clampPanToMap();}
 }
 function start(){closeSpawnMenu();inspected=null;$('objectInspector').hidden=true;layout();$('battleHandbook').hidden=true;steps=lessons();step=0;savedCamera={zoomLevel,targetZoom,panX,panY,targetPanX,targetPanY};training=true;$('battleTutorial').hidden=false;document.body.classList.add('training-active');showStep();$('guideNext').focus();}
 function finish(){training=false;$('battleTutorial').hidden=true;document.body.classList.remove('training-active');seen=true;try{localStorage.setItem(key,'done');}catch{}if(savedCamera){({zoomLevel,targetZoom,panX,panY,targetPanX,targetPanY}=savedCamera);savedCamera=null;clampPanToMap();}gameInputBlockedUntil=Date.now()+300;}
 function drawHighlight(){
  const p=training?steps[step]?.[2]:null;if(!p||!Number.isFinite(p.col)||!Number.isFinite(p.row))return;
  const center=getTileCenterLocal(p.col,p.row);push();noFill();stroke(255,220,100);strokeWeight(4/zoomLevel);circle(center.x,center.y,(useHexGrid?HEX_SIZE*2.2:TILE*1.4));pop();
 }
 function handbook(){
  const sections=lessons().map(([title,text])=>`<details><summary>${esc(title)}</summary><p>${esc(text)}</p></details>`).join('');
  $('handbookBody').innerHTML=`<p>Your current mission: <strong>${esc(typeof Endless!=='undefined'&&Endless.active?'Survive the advancing invasion':getVictoryConditionLabel(currentVictoryCondition))}</strong></p>${sections}<h3>Terrain reference</h3>${Object.entries(terrainNotes).map(([t,n])=>`<details><summary>${esc(t==='WOODS'?'Forest':t==='SWAMP'?'Marsh':t)}</summary><p>${esc(n)}</p></details>`).join('')}<h3>All units</h3>${Object.entries(UNIT_TEMPLATES).filter(([n])=>n!=='Fortress').map(([name,u])=>`<details><summary>${esc(name)}</summary>${unitDetails({...u,name,team:local(),hp:u.hp,maxHp:u.hp,morale:100,col:-1,row:-1})}</details>`).join('')}`;
  $('battleHandbook').hidden=false;$('handbookClose').focus();
 }
 function layout(){const h=$('objectInspector')?.hidden?0:$('objectInspector')?.getBoundingClientRect().height||0;document.documentElement.style.setProperty('--inspection-height',h+'px');}
 function notify(text){const el=$('battleNotice');if(!el)return;el.textContent=text;el.hidden=false;el.classList.remove('fade');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.classList.add('fade');setTimeout(()=>{if(el.classList.contains('fade'))el.hidden=true;},700);},4200);}
 function refresh(){
  if(!$('turnRibbon'))return;
  if($('mapDiplomacyButton')&&$('mapDiplomacyButton').parentElement!==$('panel'))$('panel').append($('mapDiplomacyButton'));
  const online=typeof OnlineMatch!=='undefined'&&OnlineMatch.playing,token=`${turnNumber}:${currentTeam}`,inBattle=$('mainMenu')?.classList.contains('hidden')&&!isEditorMode&&!gameOver;
  document.body.classList.toggle('battle-active',!!inBattle);$('battleMenuBtn').hidden=online;
  $('turnRibbonName').textContent=`${teamName(currentTeam)} · Turn ${turnNumber}`;
  const colors={PLAYER:0,PLAYER2:175,PLAYER3:265,PLAYER4:65,AI:145,AI2:265,AI3:205,AI4:85};$('turnRibbonImage').style.filter=`hue-rotate(${colors[currentTeam]||0}deg)`;
  if(inBattle&&lastTurn&&token!==lastTurn){
   const before=lastResources[lastTeam],after=resources[lastTeam];const gain=incomeReceipt?.team===lastTeam&&incomeReceipt.turn===Number(lastTurn.split(':')[0])?incomeReceipt:before&&after?{gold:Math.max(0,after.gold-before.gold),materials:Math.max(0,after.materials-before.materials)}:null;
   notify(`${teamName(lastTeam)} ended their turn.${gain?' Income: +💰 '+gain.gold+' · +⚒️ '+gain.materials+'.':''} ${currentTeam===local()?'Your turn!':teamName(currentTeam)+' takes command.'}`);
  }
  lastTurn=inBattle?token:'';lastTeam=currentTeam;lastResources=JSON.parse(JSON.stringify(resources||{}));
  if(inspected)renderInspection();
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const shell=document.createElement('div');shell.innerHTML=`<div id="turnRibbon"><img id="turnRibbonImage" src="assets/ui/turn-banner.png" alt=""><strong id="turnRibbonName"></strong></div><aside id="objectInspector" hidden aria-label="Selected object details"></aside><section id="battleTutorial" hidden aria-label="Captain Garran's field training"><img class="guide-portrait" src="assets/ui/captain-garran.png" alt="Captain Garran, a black-bearded warrior"><div class="guide-copy"><h2 id="guideTitle"></h2><p id="guideText" aria-live="polite"></p><nav><button id="guidePrevious">← Back</button><span id="guideProgress"></span><button id="guideNext">Next →</button><button id="guideSkip">Skip training</button></nav></div></section><section id="battleHandbook" hidden role="dialog" aria-modal="true" aria-labelledby="handbookTitle"><div class="handbook-card"><header><h2 id="handbookTitle">Captain Garran’s field manual</h2><button id="handbookClose">Close</button></header><button id="guideReplay">Replay guided training</button><div id="handbookBody"></div></div></section>`;document.body.append(shell);
  const toolbar=document.createElement('div');toolbar.id='battleToolbar';toolbar.innerHTML='<button id="battleMenuBtn">← Menu</button><button id="battleHelp" aria-label="Open tutorial and field manual">?</button>';$('panel').prepend(toolbar);if($('musicToggleBtn'))toolbar.append($('musicToggleBtn'));
  const notice=document.createElement('div');notice.id='battleNotice';notice.hidden=true;notice.setAttribute('role','status');toolbar.after(notice);if($('endlessBar'))notice.after($('endlessBar'));if($('mapDiplomacyButton'))$('panel').append($('mapDiplomacyButton'));
  for(const id of ['battleTutorial','battleHandbook','objectInspector','battleToolbar'])for(const event of ['pointerdown','pointerup','mousedown','mouseup','click','touchstart','touchend','wheel'])$(id).addEventListener(event,e=>e.stopPropagation());
  $('guideNext').onclick=()=>{if(step===steps.length-1)finish();else{step++;showStep();}};$('guidePrevious').onclick=()=>{if(step>0){step--;showStep();}};$('guideSkip').onclick=finish;$('guideReplay').onclick=start;
  $('battleHelp').onclick=handbook;$('handbookClose').onclick=()=>{$('battleHandbook').hidden=true;};
  $('battleMenuBtn').onclick=()=>{if(training)finish();$('battleHandbook').hidden=true;closeSpawnMenu();activeAITurn=null;clearTimeout(aiTurnTimeoutId);$('mainMenu').classList.remove('hidden');refresh();};
  $('menuPlayBtn')?.addEventListener('click',()=>{if(opponentType==='AI'&&isAITeam(currentTeam)&&!gameOver)setTimeout(()=>aiTakeTurn(currentTeam),400);});
  document.addEventListener('click',e=>{if(training&&!e.target.closest('#battleTutorial,#battleToolbar,#battleHandbook')){e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(training)finish();$('battleHandbook').hidden=true;}});
  setInterval(()=>{const canStart=!seen&&!training&&!isEditorMode&&!gameOver&&units.length&&$('mainMenu')?.classList.contains('hidden')&&!document.getElementById('customPopup')&&!$('campaignPage')?.classList.contains('visible')&&!$('scenarioWorkshop')?.classList.contains('visible')&&!(typeof OnlineMatch!=='undefined'&&OnlineMatch.blocksMapInput());if(canStart)start();refresh();},500);
  window.addEventListener('resize',layout);refresh();
 });
 function recordIncome(team,inc){incomeReceipt={team,turn:turnNumber,gold:inc.gold,materials:inc.materials};}
 function receiveIncome(value){if(value&&typeof value.team==='string'&&Number.isFinite(value.gold)&&Number.isFinite(value.materials)&&Number.isInteger(value.turn))incomeReceipt={team:value.team,turn:value.turn,gold:Math.max(0,value.gold),materials:Math.max(0,value.materials)};}
 return {recordIncome,receiveIncome,get incomeReceipt(){return incomeReceipt;},start,inspect,refresh,unitDetails,stats,abilities,matchups,lessons,drawHighlight,get blocking(){return training||!!$('battleHandbook')&&!$('battleHandbook').hidden;}};
})();
