// Mixed-asset diplomacy. All ownership and balances are checked again at settlement.
function tradeBundle(bundle={}) {
  return {resources:{gold:bundle.resources?.gold??0,materials:bundle.resources?.materials??0},units:bundle.units??[],settlements:bundle.settlements??[]};
}
function tradeProtectedUnit(u) {
  return u.name==='Crown'||(currentVictoryCondition.type==='KILL_UNIT_LIMIT'&&u.id===currentVictoryCondition.targetUnitId);
}
function tradeValidation(p) {
  if(p.proposer===p.target||!isAITeam(p.target))return 'Choose another AI kingdom.';
  for(const [team,raw] of [[p.proposer,p.offer],[p.target,p.request]]) {
    const b=tradeBundle(raw),r=resources[team];
    if(!r||Object.entries(b.resources).some(([k,v])=>!Number.isSafeInteger(v)||v<0||v>(r[k]||0)))return 'Both sides must have the resources listed.';
    if(!Array.isArray(b.units)||!Array.isArray(b.settlements)||new Set(b.units).size!==b.units.length||new Set(b.settlements).size!==b.settlements.length)return 'Select each asset only once.';
    for(const id of b.units){const u=units.find(u=>u.id===id&&u.hp>0&&u.team===team);if(!u||tradeProtectedUnit(u))return 'A selected unit is unavailable or protected.';
      const tile=u.row*COLS+u.col;if(settlements[tile]&&settlements[tile].owner===team&&!b.settlements.includes(tile))return 'Include the settlement beneath a selected garrison, or move the unit out first.';
    }
    for(const i of b.settlements){if(!Number.isInteger(i)||!settlements[i]||settlements[i].owner!==team)return 'A selected settlement is no longer owned by that kingdom.';
      if(currentVictoryCondition.type==='HOLD_TILE'&&i===currentVictoryCondition.holdRow*COLS+currentVictoryCondition.holdCol)return 'The mission objective cannot be traded.';
      if(units.some(u=>u.hp>0&&u.row*COLS+u.col===i&&!b.units.includes(u.id)))return 'Include every occupying unit with its settlement, or move it out first.';
    }
    if(!b.units.length&&!b.settlements.length&&!Object.values(b.resources).some(v=>v>0))return 'Choose something on each side of the deal.';
  }
  return '';
}
function tradeAssetValue(b) {
  b=tradeBundle(b);let value=b.resources.gold+b.resources.materials*1.5;
  for(const id of b.units){const u=units.find(u=>u.id===id);if(!u)continue;const c=UNIT_TEMPLATES[u.name]?.cost||1;
    const base=typeof c==='number'?c:(c.gold||0)+1.5*(c.materials||0);
    const moraleFactor=u.name==='Dragon'||u.morale===undefined?1:0.35+0.65*Math.max(0,Math.min(1,u.morale/75));
    value+=Math.max(2,base)*(0.4+0.6*Math.min(1,u.hp/u.maxHp))*moraleFactor*(1+0.15*(u.promotionLevel||0))+(u.isWaterUnit&&!UNIT_TEMPLATES[u.name]?.isWaterUnit?4:0);
  }
  for(const i of b.settlements){const s=settlements[i],income=SETTLEMENTS[s?.type]?.income||{};value+=12+12*((income.gold||0)+1.5*(income.materials||0));}
  return value;
}
function assessTrade(aiTeam,p) {
  const invalid=tradeValidation(p);if(invalid)return {chance:0,reason:invalid};
  const offer=tradeBundle(p.offer),request=tradeBundle(p.request);
  const towns=settlements.filter(s=>s?.owner===aiTeam).length;
  if(towns&&towns-request.settlements.length+offer.settlements.length<1)return {chance:0,reason:'They will not give up their last settlement without receiving another.'};
  const mobile=units.filter(u=>u.team===aiTeam&&u.hp>0&&u.dmg>0&&!isFortressUnit(u));
  const outgoing=mobile.filter(u=>request.units.includes(u.id)).length;
  const incoming=units.filter(u=>offer.units.includes(u.id)&&u.dmg>0&&!isFortressUnit(u)).length;
  if(mobile.length&&mobile.length-outgoing+incoming<Math.min(2,mobile.length))return {chance:0,reason:'The deal would leave their army too weak.'};
  // Do not sell a defender of a retained town under immediate threat.
  for(const id of request.units){const u=units.find(u=>u.id===id);if(settlements.some((s,i)=>s?.owner===aiTeam&&!request.settlements.includes(i)&&manhattan(u.col,u.row,i%COLS,Math.floor(i/COLS))<=2&&units.some(e=>e.hp>0&&e.dmg>0&&canAttack(aiTeam,e.team)&&manhattan(e.col,e.row,i%COLS,Math.floor(i/COLS))<=3)))return {chance:0,reason:'They need that unit to defend a threatened settlement.'};}
  const war=isAtWar(p.proposer,aiTeam),friend=!war&&(getTrust(aiTeam,p.proposer)>=30||hasTreaty(aiTeam,p.proposer,'DEFENSIVE_PACT')||hasTreaty(aiTeam,p.proposer,'NON_AGGRESSION'));
  // Net identical resources before valuation: padding both sides cannot disguise a loss.
  const given=tradeAssetValue(offer),asked=tradeAssetValue(request);
  const common=Math.min(offer.resources.gold,request.resources.gold)+1.5*Math.min(offer.resources.materials,request.resources.materials);
  const netAsked=asked-common,netGiven=given-common;
  if(netAsked<=0&&netGiven<=0)return {chance:0,reason:'This exchange does not change anything.'};
  const ratio=netAsked>0?netGiven/netAsked:3;
  const floor=friend?0.9:war?1.15:1;
  if(ratio<floor)return {chance:0,reason:friend?'Even friends will not accept a substantial loss.':'They want more value in return.'};
  const chance=Math.min(war?0.55:0.98,(war?0.15:friend?0.8:0.55)+Math.max(0,ratio-1)*0.35);
  return {chance,reason:war?'At war: even profitable offers may be refused.':friend?'Friendly relations allow a small concession in your favor.':'A fair exchange, but agreement is not guaranteed.'};
}
function createTradeProposal(proposer,target,type,offer,request) {
  const p={id:Math.random().toString(36).slice(2),proposer,target,type,offer:structuredClone(tradeBundle(offer)),request:structuredClone(tradeBundle(request)),status:'PENDING',turnCreated:turnNumber,expiresOn:turnNumber+3};tradeProposals.push(p);return p;
}
function evaluateTradeProposal(aiTeam,p) {
  if(p.target!==aiTeam||p.status!=='PENDING')return false;
  const a=assessTrade(aiTeam,p);p.reason=a.reason;
  // One negotiation roll per partner and turn prevents repeatedly clicking for a new result.
  const key=p.proposer+':'+aiTeam+':'+turnNumber;let hash=2166136261;
  for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),16777619);
  const accepted=((hash>>>0)%10000)/10000<a.chance;
  if(!accepted&&a.chance>0)p.reason='They declined this turn. Improve the offer or negotiate next turn. '+a.reason;
  return accepted;
}
function acceptTradeProposal(id,team) {
  const p=tradeProposals.find(p=>p.id===id&&p.status==='PENDING');if(!p||p.target!==team)return false;
  const invalid=tradeValidation(p);if(invalid||turnNumber>p.expiresOn){p.status='CANCELLED';return false;}
  const a=tradeBundle(p.offer),b=tradeBundle(p.request);
  for(const k of ['gold','materials']){resources[p.proposer][k]+=b.resources[k]-a.resources[k];resources[p.target][k]+=a.resources[k]-b.resources[k];}
  for(const [bundle,to] of [[a,p.target],[b,p.proposer]]){
    for(const id of bundle.units){const u=units.find(u=>u.id===id);u.team=to;u.hasMoved=true;u.hasActed=true;}
    for(const i of bundle.settlements)settlements[i].owner=to;
  }
  selectedUnit=null;p.status='ACCEPTED';addAIMessage(team,'Trade completed. Units remain in place and can act on their next turn.','TRADE_RESPONSE');return true;
}
function rejectTradeProposal(id,team) {
  const p=tradeProposals.find(p=>p.id===id&&p.status==='PENDING'&&p.target===team);if(!p)return false;p.status='REJECTED';addAIMessage(team,p.reason||'The offer was declined.','TRADE_RESPONSE');return true;
}
let tradeDraftTarget=null;
function closeTradeProposalModal(){document.getElementById('tradeProposalModal')?.remove();tradeDraftTarget=null;}
function openTradeProposalInterface(){
  if(!isAITeam(currentDiplomacyTarget)){showPopup('Choose an AI kingdom','Select an AI kingdom to negotiate with.','info');return;}
  closeTradeProposalModal();tradeDraftTarget=currentDiplomacyTarget;
  const old=document.getElementById('diplomacyModal');if(old)old.style.display='none';
  const modal=document.createElement('div');modal.id='tradeProposalModal';modal.className='trade-overlay';
  modal.innerHTML='<section class="trade-dialog" role="dialog" aria-modal="true" aria-labelledby="tradeTitle"><header><div><h2 id="tradeTitle">Negotiate a trade</h2><p id="tradePartner"></p></div><button id="tradeClose" aria-label="Close trade">✕</button></header><p>Exchange gold, materials, units, and settlements. No treaty required. Units stay on their tiles and wait until their next turn to act. Crowns and mission targets cannot be traded.</p><div class="trade-columns"></div><div id="tradeAssessment" role="status" aria-live="polite"></div><footer><button id="tradeSubmit">Propose deal</button><button id="tradeCancel">Cancel</button></footer></section>';
  modal.querySelector('#tradePartner').textContent='You ↔ '+getTeamDisplayName(tradeDraftTarget)+(isAtWar('PLAYER',tradeDraftTarget)?' · At war':' · At peace');
  const columns=modal.querySelector('.trade-columns');
  for(const [side,team,title] of [['offer','PLAYER','You give'],['request',tradeDraftTarget,'You receive']]){
    const panel=document.createElement('section');panel.className='trade-side';panel.dataset.side=side;
    const heading=document.createElement('h3');heading.textContent=title;panel.append(heading);
    for(const k of ['gold','materials']){const label=document.createElement('label');label.className='trade-resource';label.textContent=k+' · available '+(resources[team]?.[k]||0);const input=document.createElement('input');input.type='number';input.min='0';input.max=String(resources[team]?.[k]||0);input.step='1';input.value='0';input.dataset.resource=k;label.append(input);panel.append(label);}
    for(const kind of ['units','settlements']){
      const heading=document.createElement('h4');heading.textContent=kind==='units'?'Units':'Settlements';panel.append(heading);const list=document.createElement('div');list.className='trade-assets';
      const assets=kind==='units'?units.filter(u=>u.team===team&&u.hp>0).map(u=>({id:u.id,label:`${u.name} · ${u.hp}/${u.maxHp} HP · (${u.col+1}, ${u.row+1})`,disabled:tradeProtectedUnit(u)})):settlements.flatMap((s,i)=>s?.owner===team?[{id:i,label:`${s.type} · (${i%COLS+1}, ${Math.floor(i/COLS)+1})`}]:[]);
      for(const asset of assets){const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.value=String(asset.id);input.dataset.asset=kind;input.disabled=!!asset.disabled;label.append(input,document.createTextNode(asset.label+(asset.disabled?' · Protected':'')));list.append(label);}
      if(!assets.length)list.textContent='None owned';panel.append(list);
    }columns.append(panel);
  }
  modal.addEventListener('input',updateTradeAssessment);modal.addEventListener('click',e=>{if(e.target===modal)closeTradeProposalModal();});
  modal.addEventListener('keydown',e=>{
    if(e.key==='Escape')closeTradeProposalModal();
    if(e.key==='Tab'){const controls=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled)')],first=controls[0],last=controls.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  // Keep canvas input and shortcuts from receiving modal interactions.
  for(const name of ['pointerdown','pointerup','mousedown','mouseup','click','keydown','keyup','wheel'])modal.addEventListener(name,e=>e.stopPropagation());
  document.body.append(modal);modal.querySelector('#tradeClose').onclick=closeTradeProposalModal;modal.querySelector('#tradeCancel').onclick=closeTradeProposalModal;modal.querySelector('#tradeSubmit').onclick=submitTradeProposal;updateTradeAssessment();modal.querySelector('input').focus();
}
function readTradeDraft(){
  const p={proposer:'PLAYER',target:tradeDraftTarget};
  for(const side of ['offer','request']){const panel=document.querySelector(`[data-side="${side}"]`);p[side]={resources:Object.fromEntries([...panel.querySelectorAll('[data-resource]')].map(n=>[n.dataset.resource,n.value===''?0:Number(n.value)])),units:[...panel.querySelectorAll('[data-asset="units"]:checked')].map(n=>n.value),settlements:[...panel.querySelectorAll('[data-asset="settlements"]:checked')].map(n=>Number(n.value))};}return p;
}
function updateTradeAssessment(){
  const p=readTradeDraft(),a=assessTrade(p.target,p),can=currentTeam==='PLAYER'&&!gameOver;
  document.getElementById('tradeAssessment').textContent=can?(a.chance?`Acceptance chance: ${Math.round(a.chance*100)}%. `:'')+a.reason:'You can negotiate during your turn.';
  document.getElementById('tradeSubmit').disabled=!can||!!tradeValidation(p);
}
function submitTradeProposal(){
  if(currentTeam!=='PLAYER'||gameOver)return;
  const d=readTradeDraft(),error=tradeValidation(d);if(error){updateTradeAssessment();return;}
  const p=createTradeProposal(d.proposer,d.target,'MIXED_EXCHANGE',d.offer,d.request);
  const accepted=evaluateTradeProposal(p.target,p)&&acceptTradeProposal(p.id,p.target);
  if(!accepted)rejectTradeProposal(p.id,p.target);
  closeTradeProposalModal();updateUI();checkEndGame();showPopup(accepted?'Trade accepted':'Trade declined',accepted?'The exchange is complete. Transferred units stay in place and can act next turn.':p.reason||'The kingdom declined. Improve the offer or negotiate next turn.',accepted?'success':'info');
}
