/* Two-player, host-coordinated PeerJS rooms. No game data is stored on GitHub. */
const OnlineMatch = (() => {
  const $ = id => document.getElementById(id);
  const copy = x => JSON.parse(JSON.stringify(x));
  let peer=null, connection=null, host=false, active=false, playing=false, pending=false;
  let code='', localName='', otherName='', ready=false, otherReady=false, revision=0, accepted=null, applying=false, timeout=null;
  const team = () => host?'PLAYER':'PLAYER2';
  const connected = () => !!connection?.open && !!otherName;
  const status = text => { $('lobbyStatus').textContent=text; };
  const send = data => { if(connection?.open) connection.send({...data,protocol:1}); };
  const visible = () => !$('onlineLobby').hidden;
  function render() {
    $('lobbyRoom').textContent=code || 'Not connected';
    $('lobbyPlayers').replaceChildren();
    for(const [name,isReady,label] of [[localName,ready,host?'Host · Player 1':'You · Player 2'],[otherName,otherReady,host?'Player 2':'Host · Player 1']]) {
      const row=document.createElement('li'); row.textContent=name ? `${name} — ${label} — ${isReady?'Ready':'Not ready'}` : 'Waiting for another player…'; $('lobbyPlayers').append(row);
    }
    $('lobbyReady').disabled=!connected() || playing;
    $('lobbyReady').textContent=ready?'Not ready':'Ready';
    $('lobbyStart').hidden=!host; $('lobbyStart').disabled=!connected()||!ready||!otherReady||playing;
    $('lobbyCreate').disabled=active; $('lobbyJoin').disabled=active; $('lobbyName').disabled=active; $('lobbyCode').disabled=active;
    $('lobbyReturn').hidden=!playing;
    $('lobbyCopy').disabled=!active||!code; $('lobbyLeave').textContent=active?'Leave room':'Back to menu';
    $('onlineMatchBar').hidden=!playing;
    $('endTurnBtn').disabled=playing && (!canAct() || gameOver);
    $('onlineMatchStatus').textContent=`Room ${code} · ${localName} vs ${otherName} · ${currentTeam===team()?'Your turn':'Opponent’s turn'}${pending?' · Syncing…':''}`;
  }
  function roster() { send({type:'roster',hostName:localName,guestName:otherName,hostReady:ready,guestReady:otherReady}); render(); }
  function open() { $('onlineLobby').hidden=false; render(); }
  function failure(message) { pending=false; status(message); if(playing) open(); render(); }
  function clearTransport() { clearTimeout(timeout); const oldPeer=peer; peer=null; connection=null; oldPeer?.destroy(); }
  function leave() {
    active=false; playing=false; accepted=null; pending=false; ready=false;otherReady=false;otherName='';code='';clearTransport();
    stopHeartbeat(); opponentType='AI';gameMode='vs-ai'; myRole='P1'; isConnectedToHub=false;
    document.body.classList.remove('online-match'); $('onlineLobby').hidden=true; $('onlineMatchBar').hidden=true;
    hideEndScreen(); document.getElementById('mainMenu').classList.remove('hidden'); switchGameMode('vs-ai');
    const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url);
  }
  function createPeer(isHost) {
    if(active)return;
    localName=$('lobbyName').value.trim().slice(0,24)||'Commander';host=isHost;
    code=isHost?Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join(''):$('lobbyCode').value.trim().toUpperCase();
    if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code)){status('Enter the 8-character room code from your friend.');return;}
    if(typeof Peer==='undefined'){status('Connection library failed to load. Refresh and try again.');return;}
    active=true;ready=false;otherReady=false;otherName='';status(isHost?'Creating room…':'Finding host…');render();
    const thisPeer=new Peer(isHost?`warborn-v1-${code}`:undefined,{secure:true,debug:0});peer=thisPeer;
    timeout=setTimeout(()=>{if(peer===thisPeer&&!connected())failure('Could not connect. Check the code and host, then leave and retry. Some networks block peer connections.');},25000);
    thisPeer.on('open',()=>{
      if(peer!==thisPeer)return;
      if(host){clearTimeout(timeout);status('Room open. Share the code or invite link with a friend.');}
      else attach(thisPeer.connect(`warborn-v1-${code}`,{reliable:true,serialization:'json'}));
    });
    thisPeer.on('connection',conn=>{
      if(peer!==thisPeer||!host||connection||playing){conn.on('open',()=>{conn.send({protocol:1,type:'full'});setTimeout(()=>conn.close(),150);});return;}
      attach(conn);
    });
    thisPeer.on('error',error=>{if(peer!==thisPeer)return;failure(error.type==='unavailable-id'?'Room code is already in use. Leave and create another room.':error.type==='peer-unavailable'?'Room not found. Check the code and make sure the host is still there.':'Connection failed. Leave and retry; this network may need a relay.');});
    thisPeer.on('disconnected',()=>{if(peer===thisPeer&&!thisPeer.destroyed)thisPeer.reconnect();});
  }
  function attach(conn) {
    connection=conn;
    conn.on('open',()=>{if(connection!==conn)return;send({type:'hello',name:localName});});
    conn.on('data',msg=>{if(connection!==conn||!msg||msg.protocol!==1)return;receive(msg);});
    conn.on('close',()=>{
      if(connection!==conn)return;connection=null;otherName='';otherReady=false;ready=false;
      failure(playing?'Opponent disconnected. Return to the lobby for a new generated match.':'Player left. Waiting for another player…');
    });
    conn.on('error',()=>{if(connection===conn)failure('Connection interrupted. Leave and create a new room.');});
  }
  function snapshot() {
    return copy({cols:COLS,rows:ROWS,units,terrain,settlements,resources,startingResources,currentTeam,turnNumber,currentTurnIndex,turnOrder,
      research:Object.fromEntries(Object.entries(researchedUnits).map(([k,v])=>[k,[...v]])),diplomacy,victoryCondition:currentVictoryCondition,gameOver});
  }
  function valid(s) {
    return s && s.cols===20&&s.rows===16&&Array.isArray(s.terrain)&&s.terrain.length===320&&Array.isArray(s.settlements)&&s.settlements.length===320&&
      Array.isArray(s.units)&&s.units.length<=640&&s.units.every(u=>u&&typeof u.id==='string'&&Object.hasOwn(UNIT_TEMPLATES,u.name)&&['PLAYER','PLAYER2'].includes(u.team)&&Number.isInteger(u.col)&&Number.isInteger(u.row)&&u.col>=0&&u.col<20&&u.row>=0&&u.row<16&&Number.isFinite(u.hp)&&Number.isFinite(u.dmg))&&
      ['PLAYER','PLAYER2'].includes(s.currentTeam)&&Number.isInteger(s.turnNumber)&&s.turnNumber>0&&s.resources&&['PLAYER','PLAYER2'].every(t=>s.resources[t]&&['food','gold','materials'].every(k=>Number.isFinite(s.resources[t][k])))&&s.research&&['PLAYER','PLAYER2'].every(t=>Array.isArray(s.research[t]))&&s.startingResources&&s.diplomacy&&s.victoryCondition&&typeof s.gameOver==='boolean'&&Array.isArray(s.turnOrder)&&s.turnOrder.length===2&&new Set(s.turnOrder).size===2&&s.turnOrder.every(t=>['PLAYER','PLAYER2'].includes(t))&&s.turnOrder[s.currentTurnIndex]===s.currentTeam&&s.settlements.every(t=>t===null||(['HAMLET','VILLAGE','CITY'].includes(t.type)&&[null,'PLAYER','PLAYER2'].includes(t.owner)));
  }
  function apply(s) {
    if(!valid(s))return false;
    applying=true;
    COLS=s.cols;ROWS=s.rows;mapSize={cols:COLS,rows:ROWS};useHexGrid=true;
    units=copy(s.units);terrain=copy(s.terrain);settlements=copy(s.settlements);resources=copy(s.resources);startingResources=copy(s.startingResources);
    currentTeam=s.currentTeam;turnNumber=s.turnNumber;currentTurnIndex=s.currentTurnIndex;turnOrder=copy(s.turnOrder);
    researchedUnits=Object.fromEntries(Object.entries(s.research).map(([k,v])=>[k,new Set(v)]));diplomacy=copy(s.diplomacy);
    currentVictoryCondition=copy(s.victoryCondition);gameOver=!!s.gameOver; selectedUnit=null;closeSpawnMenu();buildMode=false;buildModeUnitId=null;
    accepted=copy(s);pending=false;for(const id of [...pendingUpdates.keys()])confirmOptimisticUpdate(id);
    updateUI();finish();render();applying=false;return true;
  }
  function fitBoard() {
    if(typeof getMapWorldBounds!=='function')return;
    const b=getMapWorldBounds(),o=getMapOrigin(),available=Math.max(400,$('panel').getBoundingClientRect().left);
    zoomLevel=targetZoom=Math.max(minZoom,Math.min(1,(available-120)/b.width,(height-160)/b.height));
    panX=targetPanX=available/2-o.x-(b.x+b.width/2)*targetZoom;
    panY=targetPanY=(height-70)/2-o.y-(b.y+b.height/2)*targetZoom;
    clampPanToMap();
  }
  function configure() {
    opponentType='HUMAN';gameMode='online-2p';myRole=host?'P1':'P2';gameId=code;isConnectedToHub=true;
    stopHeartbeat();window.hexPlayers={P1:{connected:true},P2:{connected:true}};modalManuallyClosed=true;campaignMode.active=false;isEditorMode=false;LEARNING_AI.enabled=false;
    $('mainMenu').classList.add('hidden');$('campaignPage').classList.remove('visible');$('onlineLobby').hidden=true;
    $('gameModeSelect').value='online-2p';document.body.classList.add('online-match');hideEndScreen();
    document.querySelector('#game canvas')?.focus();gameInputBlockedUntil=Date.now()+600;
  }
  function start() {
    if(!host||!connected()||!ready||!otherReady||playing)return;
    const seed=crypto.randomUUID(), map=FairMap.generate(seed);
    configure();COLS=map.cols;ROWS=map.rows;mapSize={cols:COLS,rows:ROWS};useHexGrid=true;setupGame();stopHeartbeat();LEARNING_AI.enabled=false;
    terrain=map.terrain;settlements=map.settlements;units=map.units.map(u=>makeUnit(u.name,u.team,u.col,u.row,{id:u.id}));
    resources=map.resources;startingResources=copy(map.resources);researchedUnits={PLAYER:new Set(['Soldier']),PLAYER2:new Set(['Soldier'])};
    diplomacy=createDefaultWarDiplomacy(['PLAYER','PLAYER2']);currentTeam=map.firstTeam;turnOrder=[map.firstTeam,map.firstTeam==='PLAYER'?'PLAYER2':'PLAYER'];currentTurnIndex=0;turnNumber=1;
    currentVictoryCondition=normalizeVictoryCondition({type:'ANNIHILATE_ALL'});gameOver=false;communicationLockouts={};
    playing=true;revision=0;accepted=snapshot();pending=false;selectedUnit=null;updateUI();fitBoard();render();
    send({type:'start',state:accepted,revision,seed});status(`Generated fair map ${seed.slice(0,8)}.`);
  }
  function commit(s) {revision++;accepted=copy(s);send({type:'state',state:s,revision});render();}
  function publish(actionId) {
    if(!playing||applying)return;
    if(!connected()||visible()||pending||accepted.currentTeam!==team()){if(actionId)rollbackOptimisticUpdate(actionId);return;}
    const s=snapshot();if(!valid(s))return;
    if(host){commit(s);if(actionId)confirmOptimisticUpdate(actionId);}
    else {pending=true;const base=revision;send({type:'proposal',state:s,base});render();setTimeout(()=>{if(pending&&revision===base&&playing)failure('Sync timed out. Return to the lobby or leave and reconnect.');},12000);}
  }
  function lobby() {
    playing=false;pending=false;ready=false;otherReady=false;accepted=null;hideEndScreen();open();status('New match: both players must ready up. A fresh fair map will be generated.');render();
  }
  function receive(msg) {
    if(msg.type==='full'){failure('This room is full or its match has already started.');return;}
    if(msg.type==='hello'){
      if(typeof msg.name!=='string'||msg.name.length>24)return;otherName=msg.name||'Commander';clearTimeout(timeout);
      status('Both players joined. Mark ready when you want to play.');if(host)roster();else render();return;
    }
    if(msg.type==='roster'&&!host&&!playing){otherName=String(msg.hostName).slice(0,24);otherReady=!!msg.hostReady;ready=!!msg.guestReady;render();return;}
    if(msg.type==='ready'&&host&&!playing){otherReady=!!msg.ready;roster();return;}
    if(msg.type==='start'&&!host&&!playing&&ready&&otherReady&&valid(msg.state)) {configure();playing=true;revision=0;apply(msg.state);fitBoard();status(`Generated fair map ${String(msg.seed).slice(0,8)}.`);return;}
    if(msg.type==='proposal'&&host&&playing){
      if(msg.base!==revision||accepted.currentTeam!=='PLAYER2'||!valid(msg.state)||JSON.stringify(msg.state.terrain)!==JSON.stringify(accepted.terrain)||JSON.stringify(msg.state.turnOrder)!==JSON.stringify(accepted.turnOrder)){send({type:'state',state:accepted,revision});return;}
      apply(msg.state);commit(msg.state);return;
    }
    if(msg.type==='state'&&!host&&playing&&Number.isInteger(msg.revision)&&msg.revision>=revision){if(apply(msg.state))revision=msg.revision;return;}
    if(msg.type==='lobbyRequest'&&host){lobby();send({type:'lobby'});roster();return;}
    if(msg.type==='lobby'&&!host){lobby();return;}
  }
  function returnLobby() {if(host){lobby();send({type:'lobby'});roster();}else {send({type:'lobbyRequest'});status('Waiting for the host to return to the lobby.');open();}}
  function finish() {
    if(!playing)return false;
    const winner=getWinner();if(!winner)return true;
    gameOver=true;showEndScreen({outcome:winner===team()?'victory':'defeat',explanation:winner==='DRAW'?'Draw. Neither army remains.':`${winner===team()?'You win!':'Your opponent wins.'} All opposing units and settlements were conquered.`});return true;
  }
  const canAct = () => !visible() && (!active || (playing&&connected()&&!pending&&currentTeam===team()));
  document.addEventListener('DOMContentLoaded',()=>{
    for(const id of ['onlineLobby','onlineMatchBar'])for(const event of ['pointerdown','pointerup','mousedown','mouseup','click','touchstart','touchend'])$(id).addEventListener(event,e=>e.stopPropagation());
    $('menuOnlineBtn').onclick=open;$('lobbyCreate').onclick=()=>createPeer(true);$('lobbyJoin').onclick=()=>createPeer(false);
    $('lobbyLeave').onclick=leave;$('lobbyReady').onclick=()=>{ready=!ready;if(host)roster();else{send({type:'ready',ready});render();}};
    $('lobbyStart').onclick=start;$('onlineReturnLobby').onclick=returnLobby;$('lobbyReturn').onclick=returnLobby;
    $('lobbyCopy').onclick=async()=>{const url=new URL(location.href);url.search='';url.searchParams.set('room',code);try{await navigator.clipboard.writeText(url.href);status('Invite link copied. Send it to your friend.');}catch{status(`Invite link: ${url.href}`);}};
    const room=new URLSearchParams(location.search).get('room');if(room){$('lobbyCode').value=room.toUpperCase();open();}
    document.addEventListener('click',event=>{
      if(!active)return;
      const id=event.target.closest('button,select,input')?.id;
      if(['replayScenarioBtn','backToMenuBtn'].includes(id)){event.preventDefault();event.stopImmediatePropagation();returnLobby();return;}
      if(['restartBtn','editorModeBtn','gameModeSelect','convertTeamsBtn','menuCampaignBtn'].includes(id)){event.preventDefault();event.stopImmediatePropagation();return;}
      if(!canAct()&&!event.target.closest('#onlineLobby,#onlineMatchBar')&&!event.target.closest('#game canvas')&&!['zoomInBtn','zoomOutBtn','zoomResetBtn'].includes(id)){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    setInterval(()=>{if(playing&&!applying&&!pending&&connected()&&!visible()&&accepted?.currentTeam===team()&&JSON.stringify(snapshot())!==JSON.stringify(accepted))publish();},300);
  });
  window.addEventListener('beforeunload',()=>peer?.destroy());
  return {get active(){return active;},get playing(){return playing;},get turnOrder(){return accepted?.turnOrder||['PLAYER','PLAYER2'];},blocksMapInput:()=>visible()||(active&&!playing),canAct,publish,finish,open};
})();
