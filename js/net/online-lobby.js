/* Host-coordinated 2–4 player rooms; public discovery is independent. */
const OnlineMatch = (() => {
 const $=id=>document.getElementById(id),copy=x=>JSON.parse(JSON.stringify(x)),TEAMS=['PLAYER','PLAYER2','PLAYER3','PLAYER4'];
 let peer=null,host=false,active=false,playing=false,pending=false,applying=false,suspended=false;
 let code='',localName='',localTeam='PLAYER',capacity=2,revision=0,accepted=null,timeout=null,currentTheme='',mode='competitive',difficulty='medium',aiScheduled=false,members=[],links=new Map(),hostLink=null;
 const visible=()=>!$('onlineLobby').hidden,status=text=>{$('lobbyStatus').textContent=text;};
 const tx=(c,d)=>{if(c?.open)c.send({...d,protocol:2});},send=d=>host?links.forEach(c=>tx(c,d)):tx(hostLink,d);
 const connected=()=>host?members.length>=2&&members.slice(1).every(m=>links.get(m.team)?.open):!!hostLink?.open;
 const allReady=()=>members.length===capacity&&members.every(m=>m.ready&&m.connected);
 const presence=()=>{if(typeof PublicLobby!=='undefined')PublicLobby.update();};
 function render(){
  $('lobbyRoom').textContent=code||'Not connected';$('lobbyPlayers').replaceChildren();
  for(const m of members){const row=document.createElement('li');row.textContent=m.name+' — Player '+(TEAMS.indexOf(m.team)+1)+(m.team===localTeam?' (you)':'')+' — '+(!m.connected?'Disconnected':m.ready?'Ready':'Not ready');$('lobbyPlayers').append(row);}
  $('lobbyReady').disabled=!active||playing||!members.some(m=>m.team===localTeam);
  $('lobbyReady').textContent=members.find(m=>m.team===localTeam)?.ready?'Not ready':'Ready';
  $('lobbyStart').hidden=!host;$('lobbyStart').disabled=!connected()||!allReady()||playing;
  for(const id of ['lobbyCreate','lobbyJoin','lobbyName','lobbyCode','lobbyCapacity','lobbyMode','lobbyDifficulty'])$(id).disabled=active;
  if(active){$('lobbyCapacity').value=String(capacity);$('lobbyMode').value=mode;$('lobbyDifficulty').value=difficulty;}
  $('lobbyDifficulty').hidden=$('lobbyMode').value!=='coop';$('lobbyDifficultyLabel').hidden=$('lobbyMode').value!=='coop';$('lobbyModeDescription').hidden=$('lobbyMode').value!=='coop';
  $('lobbyReturn').hidden=!playing;$('lobbyCopy').disabled=!active||!code;$('lobbyLeave').textContent=active?'Leave room':'Back to menu';
  $('onlineMatchBar').hidden=!playing;$('endTurnBtn').disabled=gameOver||isAITeam(currentTeam)||(playing&&!canAct());
  $('onlineMatchStatus').textContent='Room '+code+' · '+currentTheme+' · '+members.length+' players · '+(currentTeam===localTeam?'Your turn':(members.find(m=>m.team===currentTeam)?.name||currentTeam)+'’s turn')+(pending?' · Syncing…':'');
  presence();
 }
 function roster(){send({type:'roster',members,capacity,mode,difficulty});render();}
 function open(){$('onlineLobby').hidden=false;render();}
 function failure(message){pending=false;suspended=true;status(message);if(playing)open();render();}
 function leave(){
  if(typeof Endless!=='undefined')Endless.stop();activeAITurn=null;aiScheduled=false;
  const old=peer;peer=null;active=false;playing=false;suspended=false;pending=false;accepted=null;members=[];links.clear();hostLink=null;code='';clearTimeout(timeout);old?.destroy();
  stopHeartbeat();opponentType='AI';gameMode='vs-ai';myRole='P1';isConnectedToHub=false;
  document.body.classList.remove('online-match');$('onlineLobby').hidden=true;$('onlineMatchBar').hidden=true;
  hideEndScreen();$('mainMenu').classList.remove('hidden');switchGameMode('vs-ai');presence();
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url);
 }
 function createPeer(isHost,joinCode){
  if(active)return;
  localName=$('lobbyName').value.trim().slice(0,24)||'Commander';host=isHost;capacity=Number($('lobbyCapacity').value)||2;
  if(![2,3,4].includes(capacity))capacity=2;
  mode=$('lobbyMode').value==='coop'?'coop':'competitive';difficulty=['easy','medium','hard','impossible'].includes($('lobbyDifficulty').value)?$('lobbyDifficulty').value:'medium';
  code=isHost?Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join(''):(joinCode||$('lobbyCode').value).trim().toUpperCase();
  if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code)){status('Enter an 8-character room code.');return;}
  if(typeof Peer==='undefined'){status('Connection library unavailable. Refresh and retry.');return;}
  active=true;suspended=false;localTeam=isHost?'PLAYER':null;members=isHost?[{team:'PLAYER',name:localName,ready:false,connected:true}]:[];
  status(isHost?'Opening room…':'Joining room…');render();
  const p=new Peer(isHost?'warborn-v2-'+code:undefined,{secure:true,debug:0});peer=p;
  timeout=setTimeout(()=>{if(peer===p&&!host&&!members.length)failure('Could not join. Check the host and network, then leave and retry.');},25000);
  p.on('open',()=>{
   if(peer!==p)return;
   // Reopening the signaling socket must not replace an established data link.
   if(playing||hostLink?.open)return;
   if(host){clearTimeout(timeout);status('Room open. Join from the public lobby or with a code.');render();}
   else attach(p.connect('warborn-v2-'+code,{reliable:true,serialization:'json'}),p);
  });
  p.on('connection',c=>{
   if(peer!==p||!host||playing||links.size>=capacity-1){c.on('open',()=>{tx(c,{type:'full'});setTimeout(()=>c.close(),300);});return;}
   const slot=TEAMS.slice(1,capacity).find(t=>!links.has(t));links.set(slot,c);attach(c,p,slot);
  });
  p.on('error',e=>{if(peer===p&&playing&&connected()&&['network','server-error','socket-error','socket-closed'].includes(e.type)){status('Signaling interrupted; the existing game connection is still active.');return;}if(peer===p)failure(e.type==='peer-unavailable'?'Room not found or the host is offline.':e.type==='unavailable-id'?'Room code already in use. Leave and retry.':'Connection failed. Leave and retry; some networks block peer connections.');});
  p.on('disconnected',()=>{if(peer===p&&!p.destroyed)p.reconnect();});
 }
 function attach(c,p,slot){
  if(!host)hostLink=c;
  const live=()=>peer===p&&(host?links.get(slot)===c:hostLink===c);
  c.on('open',()=>{if(live()&&!host)tx(c,{type:'hello',name:localName});});
  c.on('data',m=>{if(live()&&m?.protocol===2)receive(m,c,slot);});
  c.on('close',()=>{
   if(!live())return;
   if(host){links.delete(slot);if(playing){const m=members.find(m=>m.team===slot);if(m)m.connected=false;send({type:'pause'});failure('A player disconnected. Return to the room for a new match.');}
    else{members=members.filter(m=>m.team!==slot);members.forEach(m=>m.ready=false);status('Player left. Everyone must ready up again.');}roster();}
   else{hostLink=null;failure('The host disconnected. Leave and join or create another room.');}
  });
  c.on('error',()=>{if(live())failure('Connection interrupted. Leave and reconnect.');});
  if(host)setTimeout(()=>{if(live()&&!members.some(m=>m.team===slot))c.close();},15000);
 }
 function snapshot(){
  return copy({incomeReceipt:typeof BattleGuide!=='undefined'?BattleGuide.incomeReceipt:null,effects:ActionEffects.snapshot(),mode,difficulty,endless:mode==='coop'?Endless.snapshot():null,playerCount:capacity,theme:currentTheme,cols:COLS,rows:ROWS,units,terrain,settlements,resources,startingResources,currentTeam,turnNumber,currentTurnIndex,turnOrder,
   research:Object.fromEntries(Object.entries(researchedUnits).map(([k,v])=>[k,[...v]])),diplomacy,victoryCondition:currentVictoryCondition,gameOver});
 }
 function valid(s){
  const teams=mode==='coop'?[...TEAMS.slice(0,capacity),'AI']:TEAMS.slice(0,capacity),cols=mode==='coop'?8*capacity+2:capacity===2?20:21,rows=mode==='coop'?20:capacity===2?16:21;
  if(mode==='coop'&&(!s?.endless||s.endless.difficulty!==difficulty||!Number.isInteger(s.endless.seed)||!Number.isInteger(s.endless.wave)||s.endless.wave<1||s.endless.lastAdvance!==s.turnNumber||JSON.stringify(s.endless.players)!==JSON.stringify(TEAMS.slice(0,capacity))||typeof s.endless.lossReason!=='string'))return false;
  return s&&(s.mode||'competitive')===mode&&s.playerCount===capacity&&(mode==='coop'?s.theme==='Cooperative Endless':FairMap.themes.some(t=>t.name===s.theme))&&s.cols===cols&&s.rows===rows&&
   Array.isArray(s.terrain)&&s.terrain.length===cols*rows&&s.terrain.every(t=>[null,'GRASS','WOODS','MOUNTAIN','SWAMP','DESERT','WATER','BRIDGE','FARM','FOUNTAIN','VOID'].includes(t))&&
   Array.isArray(s.settlements)&&s.settlements.length===cols*rows&&s.settlements.every(t=>t===null||(['HAMLET','VILLAGE','CITY','PORT'].includes(t.type)&&[null,...teams].includes(t.owner)))&&
   Array.isArray(s.units)&&s.units.length<=1000&&new Set(s.units.map(u=>u?.id)).size===s.units.length&&s.units.every(u=>u&&typeof u.id==='string'&&Object.hasOwn(UNIT_TEMPLATES,u.name)&&teams.includes(u.team)&&Number.isInteger(u.col)&&Number.isInteger(u.row)&&u.col>=0&&u.col<cols&&u.row>=0&&u.row<rows&&s.terrain[u.row*cols+u.col]!=='VOID'&&Number.isFinite(u.hp)&&u.hp>0&&Number.isFinite(u.dmg))&&
   teams.includes(s.currentTeam)&&Number.isInteger(s.turnNumber)&&s.turnNumber>0&&s.resources&&s.startingResources&&s.research&&teams.every(t=>s.resources[t]&&['gold','materials'].every(k=>Number.isFinite(s.resources[t][k])&&s.resources[t][k]>=0)&&Array.isArray(s.research[t]))&&
   s.diplomacy&&s.victoryCondition&&typeof s.gameOver==='boolean'&&Array.isArray(s.turnOrder)&&s.turnOrder.length===teams.length&&new Set(s.turnOrder).size===teams.length&&s.turnOrder.every(t=>teams.includes(t))&&s.turnOrder[s.currentTurnIndex]===s.currentTeam;
 }
 function apply(s){
  if(!valid(s))return false;applying=true;currentTheme=s.theme;ActionEffects.receive(s.effects);
  const resized=COLS!==s.cols||ROWS!==s.rows;COLS=s.cols;ROWS=s.rows;mapSize={cols:COLS,rows:ROWS};useHexGrid=true;
  if(resized&&typeof updateHexSize==='function'){TILE=BOARD_SIZE/COLS;updateHexSize();resizeGameCanvas();}
  units=copy(s.units);terrain=copy(s.terrain);settlements=copy(s.settlements);resources=copy(s.resources);startingResources=copy(s.startingResources);
  currentTeam=s.currentTeam;turnNumber=s.turnNumber;currentTurnIndex=s.currentTurnIndex;turnOrder=copy(s.turnOrder);
  researchedUnits=Object.fromEntries(Object.entries(s.research).map(([k,v])=>[k,new Set(v)]));diplomacy=copy(s.diplomacy);
  currentVictoryCondition=copy(s.victoryCondition);gameOver=s.gameOver;selectedUnit=null;closeSpawnMenu();buildMode=false;buildModeUnitId=null;
  if(typeof Endless!=='undefined')Endless.restore(mode==='coop'?copy(s.endless):null);
  if(typeof BattleGuide!=='undefined')BattleGuide.receiveIncome(s.incomeReceipt);
  accepted=copy(s);pending=false;for(const id of [...pendingUpdates.keys()])confirmOptimisticUpdate(id);
  updateUI();finish();render();applying=false;return true;
 }
 function fitBoard(){
  if(typeof getMapWorldBounds!=='function')return;
  const b=getMapWorldBounds(),o=getMapOrigin(),available=typeof CommandMenu!=='undefined'?width:Math.max(400,$('panel').getBoundingClientRect().left);
  zoomLevel=targetZoom=Math.max(minZoom,Math.min(1,(available-120)/b.width,(height-160)/b.height));
  panX=targetPanX=available/2-o.x-(b.x+b.width/2)*targetZoom;panY=targetPanY=(height-70)/2-o.y-(b.y+b.height/2)*targetZoom;clampPanToMap();
 }
 function configure(){
  if(typeof Endless!=='undefined')Endless.stop();
  ActionEffects.reset();opponentType='HUMAN';gameMode='online-2p';myRole='P'+(TEAMS.indexOf(localTeam)+1);gameId=code;isConnectedToHub=true;
  stopHeartbeat();window.hexPlayers=Object.fromEntries(members.map(m=>['P'+(TEAMS.indexOf(m.team)+1),{connected:m.connected}]));
  modalManuallyClosed=true;campaignMode.active=false;isEditorMode=false;LEARNING_AI.enabled=false;
  $('mainMenu').classList.add('hidden');$('campaignPage').classList.remove('visible');$('onlineLobby').hidden=true;
  $('gameModeSelect').value='online-2p';document.body.classList.add('online-match');hideEndScreen();document.querySelector('#game canvas')?.focus();gameInputBlockedUntil=Date.now()+600;
 }
 function start(){
  if(!host||!connected()||!allReady()||playing)return;
  if(mode==='coop'){
   configure();Endless.start(difficulty,crypto.getRandomValues(new Uint32Array(1))[0],TEAMS.slice(0,capacity));currentTheme='Cooperative Endless';
   turnOrder=[...TEAMS.slice(0,capacity),'AI'];currentTeam='PLAYER';currentTurnIndex=0;
   LEARNING_AI.enabled=false;playing=true;suspended=false;revision=0;accepted=snapshot();pending=false;updateUI();fitBoard();render();send({type:'start',state:accepted,revision});status('Cooperative Endless started. Hold the line together!');return;
  }
  const seed=crypto.randomUUID(),map=FairMap.generateForPlayers(seed,capacity);currentTheme=map.theme.name;
  configure();COLS=map.cols;ROWS=map.rows;mapSize={cols:COLS,rows:ROWS};useHexGrid=true;setupGame();stopHeartbeat();LEARNING_AI.enabled=false;
  terrain=map.terrain;settlements=map.settlements;units=map.units.map(u=>makeUnit(u.name,u.team,u.col,u.row,{id:u.id}));
  const teams=TEAMS.slice(0,capacity);resources=map.resources;startingResources=copy(map.resources);researchedUnits=Object.fromEntries(teams.map(t=>[t,new Set(['Soldier'])]));
  diplomacy=createDefaultWarDiplomacy(teams);currentTeam=map.firstTeam;const first=teams.indexOf(currentTeam);turnOrder=[...teams.slice(first),...teams.slice(0,first)];currentTurnIndex=0;turnNumber=1;
  currentVictoryCondition=normalizeVictoryCondition({type:'ANNIHILATE_ALL'});gameOver=false;communicationLockouts={};
  playing=true;suspended=false;revision=0;accepted=snapshot();pending=false;selectedUnit=null;updateUI();fitBoard();render();
  send({type:'start',state:accepted,revision,seed});status('Fresh '+capacity+'-player '+currentTheme+' map generated.');
 }
 function commit(s){revision++;accepted=copy(s);send({type:'state',state:s,revision});render();scheduleAI();}
 function canRunAI(){return host&&playing&&mode==='coop'&&connected()&&!suspended&&!visible()&&!gameOver;}
 function scheduleAI(){
  if(!canRunAI()||!isAITeam(currentTeam)||aiScheduled)return;
  aiScheduled=true;const round=turnNumber;setTimeout(()=>{aiScheduled=false;if(canRunAI()&&currentTeam==='AI'&&turnNumber===round)aiTakeTurn('AI');},300);
 }
 function publish(actionId){
  if(!playing||applying)return;
  if(!connected()||visible()||suspended||pending||(accepted.currentTeam!==localTeam&&!(host&&mode==='coop'&&isAITeam(accepted.currentTeam)))){if(actionId)rollbackOptimisticUpdate(actionId);return;}
  const s=snapshot();if(!valid(s))return;
  if(host){commit(s);if(actionId)confirmOptimisticUpdate(actionId);}
  else{pending=true;const base=revision;send({type:'proposal',state:s,base});render();setTimeout(()=>{if(pending&&revision===base&&playing&&!document.hidden)failure('Sync timed out. Return to the room or reconnect.');},12000);}
 }
 function lobby(){
  if(typeof Endless!=='undefined')Endless.stop();activeAITurn=null;aiScheduled=false;playing=false;pending=false;suspended=false;accepted=null;members=members.filter(m=>m.team==='PLAYER'||(host?links.get(m.team)?.open:m.connected));members.forEach(m=>m.ready=false);
  hideEndScreen();open();status('Ready up for a fresh match. Vacant slots must be filled.');render();
 }
 function receive(msg,c,slot){
  if(msg.type==='syncRequest'&&host&&playing){if(accepted.currentTeam===localTeam||isAITeam(accepted.currentTeam))publish();tx(c,{type:'state',state:accepted,revision,resume:true,paused:suspended});scheduleAI();return;}
  if(msg.type==='full'){failure('Room full or already playing. Leave and choose another.');return;}
  if(msg.type==='hello'&&host&&!playing){
   if(typeof msg.name!=='string'||msg.name.length>24||members.some(m=>m.team===slot))return;
   members.push({team:slot,name:msg.name||'Commander',ready:false,connected:true});members.sort((a,b)=>TEAMS.indexOf(a.team)-TEAMS.indexOf(b.team));members.forEach(m=>m.ready=false);
   tx(c,{type:'welcome',team:slot,capacity,mode,difficulty});roster();status('Everyone must be ready to start.');return;
  }
  if(msg.type==='welcome'&&!host&&TEAMS.includes(msg.team)&&[2,3,4].includes(msg.capacity)){localTeam=msg.team;capacity=msg.capacity;mode=msg.mode==='coop'?'coop':'competitive';difficulty=['easy','medium','hard','impossible'].includes(msg.difficulty)?msg.difficulty:'medium';clearTimeout(timeout);render();return;}
  if(msg.type==='roster'&&!host&&Array.isArray(msg.members)&&msg.members.length<=4){members=msg.members.map(m=>({team:m.team,name:String(m.name).slice(0,24),ready:!!m.ready,connected:!!m.connected}));render();return;}
  if(msg.type==='ready'&&host&&!playing){const m=members.find(m=>m.team===slot);if(m)m.ready=!!msg.ready;roster();return;}
  if(msg.type==='start'&&!host&&!playing&&allReady()&&valid(msg.state)){configure();playing=true;suspended=false;revision=0;apply(msg.state);fitBoard();return;}
  if(msg.type==='proposal'&&host&&playing){
   if(suspended||msg.base!==revision||accepted.currentTeam!==slot||!valid(msg.state)||JSON.stringify(msg.state.terrain)!==JSON.stringify(accepted.terrain)||JSON.stringify(msg.state.turnOrder)!==JSON.stringify(accepted.turnOrder)||(mode==='coop'&&(JSON.stringify({...msg.state.endless,lossReason:''})!==JSON.stringify({...accepted.endless,lossReason:''})||msg.state.turnNumber!==accepted.turnNumber))){tx(c,{type:'state',state:accepted,revision});return;}
   apply(msg.state);commit(msg.state);return;
  }
  if(msg.type==='state'&&!host&&playing&&Number.isInteger(msg.revision)&&msg.revision>=revision){if(apply(msg.state)){revision=msg.revision;if(msg.resume&&!msg.paused&&connected()){suspended=false;$('onlineLobby').hidden=true;render();}}return;}
  if(msg.type==='pause'&&!host){failure('A player disconnected. The host can return everyone to the room.');return;}
  if(msg.type==='lobbyRequest'&&host){lobby();send({type:'lobby'});roster();return;}
  if(msg.type==='lobby'&&!host){lobby();return;}
 }
 function returnLobby(){if(host){lobby();send({type:'lobby'});roster();}else{send({type:'lobbyRequest'});status('Waiting for host…');open();}}
 function eliminated(t){if(mode==='coop'&&t==='AI')return false;return (currentVictoryCondition.crownFallenTeams||[]).includes(t)||(!units.some(u=>u.hp>0&&u.team===t)&&!settlements.some(s=>s?.owner===t));}
 function finish(){
  if(!playing)return false;if(mode==='coop'){if(gameOver)showEndScreen({outcome:'defeat',explanation:(Endless.lossReason||'The allied kingdoms have fallen.')+' Your team survived '+(Endless.wave-1)+' rounds on '+difficulty+'.'});return true;}const alive=TEAMS.slice(0,capacity).filter(t=>!eliminated(t));if(alive.length>1)return true;
  gameOver=true;const winner=alive[0];showEndScreen({outcome:winner===localTeam?'victory':'defeat',explanation:winner?winner===localTeam?'You are the last kingdom standing!':'The last kingdom standing is '+(members.find(m=>m.team===winner)?.name||winner)+'.':'Draw. No kingdom remains.'});return true;
 }
 const canAct=()=>!visible()&&(!active||(playing&&connected()&&!suspended&&!pending&&!eliminated(localTeam)&&currentTeam===localTeam));
 function invite(id){if(!active)createPeer(true);if(active&&host&&!playing&&typeof PublicLobby!=='undefined')PublicLobby.invite(id,code);}
 document.addEventListener('DOMContentLoaded',()=>{
  for(const id of ['onlineLobby','onlineMatchBar'])for(const event of ['pointerdown','pointerup','mousedown','mouseup','click','touchstart','touchend'])$(id).addEventListener(event,e=>e.stopPropagation());
  $('lobbyMode').onchange=render;$('menuOnlineBtn').onclick=open;$('lobbyCreate').onclick=()=>createPeer(true);$('lobbyJoin').onclick=()=>createPeer(false);
  $('lobbyLeave').onclick=leave;$('lobbyReady').onclick=()=>{const m=members.find(m=>m.team===localTeam);if(!m||playing)return;m.ready=!m.ready;if(host)roster();else{send({type:'ready',ready:m.ready});render();}};
  $('lobbyStart').onclick=start;$('onlineReturnLobby').onclick=returnLobby;$('lobbyReturn').onclick=returnLobby;
  $('lobbyCopy').onclick=async()=>{const url=new URL(location.href);url.search='';url.searchParams.set('room',code);try{await navigator.clipboard.writeText(url.href);status('Invite link copied.');}catch{status('Invite link: '+url.href);}};
  $('lobbyName').addEventListener('input',presence);
  const room=new URLSearchParams(location.search).get('room');if(room){$('lobbyCode').value=room.toUpperCase();open();}
  document.addEventListener('click',event=>{
   if(!active)return;const id=event.target.closest('button,select,input')?.id;
   if(['replayScenarioBtn','backToMenuBtn'].includes(id)){event.preventDefault();event.stopImmediatePropagation();returnLobby();return;}
   if(['restartBtn','editorModeBtn','gameModeSelect','convertTeamsBtn','menuCampaignBtn'].includes(id)){event.preventDefault();event.stopImmediatePropagation();return;}
   if(!canAct()&&!event.target.closest('#onlineLobby,#onlineMatchBar,#endlessExit,#musicToggleBtn,#battleHelp,#battleHandbook,#battleTutorial,#battleMenuBtn,#commandToggle,#commandContents')&&!event.target.closest('#game canvas')){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  setInterval(()=>{if(playing&&!applying&&!pending&&connected()&&!visible()&&!suspended&&(accepted?.currentTeam===localTeam||(host&&mode==='coop'&&isAITeam(accepted?.currentTeam||'')))&&JSON.stringify(snapshot())!==JSON.stringify(accepted))publish();},300);
 });
 function resume(){if(!playing||document.hidden)return;if(host){publish();scheduleAI();}else send({type:'syncRequest'});updateUI();}
 document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);
 window.addEventListener('beforeunload',()=>peer?.destroy());
 return {canRunAI,returnLobby,get isHost(){return host;},get coop(){return mode==='coop'&&playing;},get active(){return active;},get playing(){return playing;},get localTeam(){return localTeam;},playerName:team=>members.find(m=>m.team===team)?.name||(team==='AI'?'Invaders':team),get teams(){return mode==='coop'?[...TEAMS.slice(0,capacity),'AI']:TEAMS.slice(0,capacity);},get turnOrder(){return accepted?.turnOrder||(mode==='coop'?[...TEAMS.slice(0,capacity),'AI']:TEAMS.slice(0,capacity));},
  get publicInfo(){return {room:active?code:'',host:active&&host,count:members.length,capacity,playing,mode,difficulty,where:playing?'In battle':active?'In a room':visible()?'In lobby':'Browsing'};},
  blocksMapInput:()=>visible()||(active&&!playing),canAct,publish,finish,open,eliminated,invite,join:code=>{open();createPeer(false,code);}};
})();
