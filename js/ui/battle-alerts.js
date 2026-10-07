// Small actionable battle notices; no notifications are shown to spectators.
const BattleAlerts=(()=>{
 function refresh(){
  let box=document.getElementById('battleAlerts');if(!box){box=document.createElement('aside');box.id='battleAlerts';document.body.appendChild(box);}
  const mine=getLocalPlayableTeam(),menu=document.getElementById('mainMenu');
  if(gameOver||isEditorMode||(typeof watchGameMode!=='undefined'&&watchGameMode)||(menu&&!menu.classList.contains('hidden'))){box.replaceChildren();delete box.dataset.signature;return;}
  const home=settlements.findIndex(s=>s?.owner===mine),available=home>=0&&!activeResearch[mine]&&getAvailableResearch(mine).length>0;
  const offers=Object.entries(diplomacy.peaceBeggingFlags||{}).filter(([t,expiry])=>expiry>=turnNumber&&!isNationEliminated(t)&&!hasTreaty(mine,t,'NON_AGGRESSION'));
  const signature=JSON.stringify([available,home,offers]);if(box.dataset.signature===signature)return;box.dataset.signature=signature;box.replaceChildren();
  const add=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;box.appendChild(b);};
  if(available)add('Research Available',()=>openSpawnMenu(home%COLS,Math.floor(home/COLS),settlements[home],'research'));
  for(const [team]of offers)add(getTeamDisplayName(team)+' offers treaty',()=>{openDiplomacyNegotiation();selectDiplomacyTarget(team);});
 }
 function preview(){
  let box=document.getElementById('combatPreview');if(!box){box=document.createElement('div');box.id='combatPreview';document.body.appendChild(box);}box.hidden=true;
  const a=selectedUnit;if(!a||a.hp<=0||a.morale<=0||a.hasActed||a.team!==currentTeam||['Cleric','Crown'].includes(a.name)||isEditorMode||gameOver)return;
  if(document.getElementById('spawnMenu')||document.getElementById('diplomacyModal')?.style.display==='flex')return;
  const p=mouseToWorldCoords(mouseX,mouseY),d=getUnitAt(p.col,p.row);
  if(!d||d.hp<=0||d.ruins||(!d.rogue&&(areFriendlyTeams(a.team,d.team)||!canAttack(a.team,d.team)))||manhattan(a.col,a.row,d.col,d.row)>a.atkRange)return;
  if(a.name==='Catapult'&&a.hasMoved)return;
  if(terrain[a.row*COLS+a.col]==='SWAMP'&&TERRAIN.SWAMP.noAttack&&!['Assassin','Dragon'].includes(a.name))return;
  const result=calculateCombatDamage(a,d),base=UNIT_TEMPLATES[a.name]?.dmg||a.dmg,permanent=a.dmg-base;
  box.innerHTML=`<strong>${result.damage} expected damage${result.damage>=d.hp?' · lethal':''}</strong><small>Base damage: ${base}${permanent?` + ${permanent} from doctrines / promotions = ${a.dmg}`:''}</small>`+result.modifiers.map(m=>`<small>${m.label}: ${Math.round((m.multiplier-1)*100)}%</small>`).join('');
  const board=document.querySelector('#game canvas'),rect=board?.getBoundingClientRect();if(!rect)return;
  box.hidden=false;box.style.left=Math.max(8,Math.min(innerWidth-box.offsetWidth-8,rect.left+mouseX-box.offsetWidth/2))+'px';box.style.top=Math.max(8,rect.top+mouseY-box.offsetHeight-25)+'px';
 }
 return {refresh,preview};
})();
