// A 20-row invasion corridor: 10 columns solo, eight more for each ally.
const Endless = (() => {
  const difficulties = {
    easy:{name:'Easy',base:1,growth:22,townEvery:4,eliteAt:36,maxWave:3,forward:4,description:'One enemy per row at first. Slow escalation.'},
    medium:{name:'Medium',base:1,growth:10,townEvery:3,eliteAt:18,maxWave:5,forward:2,description:'Waves grow sooner, with earlier elite units.'},
    hard:{name:'Hard',base:2,growth:8,townEvery:3,eliteAt:10,maxWave:6,forward:1,description:'Two enemies per row at first. Early elites.'},
    impossible:{name:'Impossible',base:3,growth:5,townEvery:2,eliteAt:6,maxWave:6,forward:0,description:'Three enemies per row at first. Rapid escalation and dragons.'}
  };
  let active=false,difficulty='medium',seed=0,wave=0,lastAdvance=1,previousScenario=null,players=['PLAYER'],lossReason='';
  const $=id=>document.getElementById(id);
  function random(row,col,salt=0){let h=(seed^Math.imul(row+101,374761393)^Math.imul(col+31,668265263)^salt)>>>0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
  function rowTerrain(index){
    const biomes=[['GRASS','WOODS','GRASS'],['DESERT','MOUNTAIN','DESERT'],['WOODS','GRASS','WOODS'],['SWAMP','GRASS','GRASS']];
    const biome=biomes[Math.floor(random(Math.floor(index/6),0,13)*biomes.length)];
    return Array.from({length:8*players.length+2},(_,col)=>col===0||col===8*players.length+1?'WATER':col%8===4||col%8===5?'GRASS':biome[Math.floor(random(index,col)*biome.length)]);
  }
  function waveNames(n){
    const p=difficulties[difficulty],count=Math.min(p.maxWave,p.base+Math.floor((n-1)/p.growth));
    const pool=difficulty==='easy'&&n<=10?['Soldier']:n>=p.eliteAt?['Knight','Swordsman','Assassin','Archer','Cleric','Dragon']:n>=Math.ceil(p.eliteAt/2)?['Soldier','Spearman','Archer','Swordsman']:['Soldier','Archer','Spearman'];
    return Array.from({length:count},(_,i)=>{
      if(n>=p.eliteAt&&n%3===0&&i===count-1)return 'Dragon';
      const name=pool[Math.floor(random(n,i,771)*pool.length)];
      return i===0&&name==='Cleric'?'Knight':name;
    });
  }
  function spawnWave(row=0){
    for(let lane=0;lane<players.length;lane++){
    const names=waveNames(wave),columns=[2,7,3,6,4,5].map(c=>c+lane*8);
    names.forEach((name,i)=>units.push(makeUnit(name,'AI',columns[i],row)));
    if(wave===1||wave%difficulties[difficulty].townEvery===0){
      const col=(wave%2?2:7)+lane*8;
      settlements[row*COLS+col]={type:wave>=difficulties[difficulty].eliteAt?'CITY':difficulty==='easy'&&wave%2?'HAMLET':'VILLAGE',owner:'AI'};
      terrain[row*COLS+col]='GRASS';
    }
  }
  }
  function refresh(){
    document.body.classList.toggle('endless-match',active);
    const bar=$('endlessBar');if(bar)bar.hidden=!active;
    if($('endlessStatus'))$('endlessStatus').textContent=`${players.length>1?players.length+'-player Co-op · ':''}${difficulties[difficulty].name} · Wave ${wave} · ${Math.max(0,wave-1)} ${wave===2?'round':'rounds'} survived`;
    if($('endlessWarning')){
      const trapped=units.filter(u=>u.team===(players.length>1?OnlineMatch.localTeam:'PLAYER')&&u.hp>0&&u.row===19).length;
      $('endlessWarning').textContent=trapped?`${trapped} of your units will be lost when the red row disappears!`:'Enemies enter at the top. Stop them before they reach the red bottom row.';
    }
    for(const id of ['editorModeBtn','increaseAIBtn','decreaseAIBtn','convertTeamsBtn'])if($(id))$(id).disabled=active;
  }
  function stop(){active=false;refresh();}
  function fit(){
    const b=getMapWorldBounds(),o=getMapOrigin(),available=typeof CommandMenu!=='undefined'?width:Math.max(320,$('panel').getBoundingClientRect().left);
    zoomLevel=targetZoom=Math.max(minZoom,Math.min(1,(available-100)/b.width,(height-210)/b.height));
    panX=targetPanX=available/2-o.x-(b.x+b.width/2)*targetZoom;
    panY=targetPanY=(height+70)/2-o.y-(b.y+b.height/2)*targetZoom;clampPanToMap();
  }
  function start(level='medium',replaySeed=null,coopPlayers=null){
    if(typeof OnlineMatch!=='undefined'&&OnlineMatch.active&&!coopPlayers)return;
    if(!difficulties[level])return;
    if(!active&&activeScenarioSnapshot)previousScenario=clonePlain(activeScenarioSnapshot);
    players=coopPlayers||['PLAYER'];lossReason='';difficulty=level;seed=replaySeed??Math.floor(Math.random()*4294967296);wave=1;lastAdvance=1;
    active=false;campaignMode.active=false;if(!coopPlayers){opponentType='AI';gameMode='vs-ai';myRole='P1';}currentAIPlayers=1;isEditorMode=false;
    setupGame();
    active=true;COLS=8*players.length+2;ROWS=20;mapSize={cols:COLS,rows:20};TILE=BOARD_SIZE/COLS;useHexGrid=true;updateHexSize();resizeGameCanvas();
    terrain=Array.from({length:20},(_,row)=>rowTerrain(-row)).flat();settlements=Array(COLS*20).fill(null);units=[];
    if(typeof restoreResearchPoints==='function')restoreResearchPoints();
    if(typeof restoreActiveResearch==='function')restoreActiveResearch();
    if(typeof restoreResearch==='function')restoreResearch(null,Object.fromEntries([...players,'AI'].map(t=>[t,t!=='AI'&&difficulty==='easy'?['Soldier','Archer','Cleric']:['Soldier']])),[...players,'AI']);
    const forward=difficulties[difficulty].forward;
    players.forEach((team,lane)=>{
    [['Knight',4,14],['Soldier',3,14],['Spearman',5,14],['Archer',6,15],['Cleric',4,16]].forEach(([name,col,row])=>units.push(makeUnit(name,team,col+lane*8,row-forward)));
    if(difficulty==='easy')units.push(makeUnit('Knight',team,6+lane*8,14-forward));
    settlements[(15-forward)*COLS+4+lane*8]={type:'CITY',owner:team};
    settlements[(10-Math.min(forward,2))*COLS+5+lane*8]={type:'VILLAGE',owner:null};
    settlements[5*COLS+7+lane*8]={type:'VILLAGE',owner:'AI'};
    units.push(makeUnit('Soldier','AI',7+lane*8,5));
    });
    for(let i=0;i<settlements.length;i++)if(settlements[i])terrain[i]='GRASS';
    for(const u of units)terrain[u.row*COLS+u.col]='GRASS';
    spawnWave();
    if(typeof AICommander!=='undefined')AICommander.reset();
    resetStartingEconomy();if(typeof restoreResearch!=='function')researchedUnits=Object.fromEntries([...players,'AI'].map(t=>[t,new Set(t!=='AI'&&difficulty==='easy'?['Soldier','Archer','Cleric']:['Soldier'])]));
    diplomacy=createDefaultWarDiplomacy([...players,'AI']);currentVictoryCondition=normalizeVictoryCondition({type:'ANNIHILATE_ALL'});
    currentTeam='PLAYER';turnNumber=1;currentTurnIndex=0;calculateTurnOrder();selectedUnit=null;gameOver=false;
    tradeProposals=[];communicationLockouts={};hideEndScreen();closeSpawnMenu();closeTradeProposalModal();
    $('mainMenu')?.classList.add('hidden');$('campaignPage')?.classList.remove('visible');$('endlessMenu').hidden=true;
    if($('diplomacyModal'))$('diplomacyModal').style.display='none';
    gameInputBlockedUntil=Date.now()+500;updateTeamSelector();applyVictoryConditionToUI();updateUI();fit();captureScenarioSnapshot();refresh();
  }
  function lose(reason){lossReason=reason;gameOver=true;activeAITurn=null;clearTimeout(aiTurnTimeoutId);showEndScreen({outcome:'defeat',explanation:`${reason} You survived ${wave-1} rounds on ${difficulties[difficulty].name}.`});refresh();}
  function check(){
    if(!active||gameOver)return;
    if(units.some(u=>u.hp>0&&u.team==='AI'&&u.row>=19)){lose('An enemy reached the back edge.');return;}
    if(!units.some(u=>u.hp>0&&players.includes(u.team))&&!settlements.some(s=>players.includes(s?.owner)))lose('Your last unit and settlement are gone.');
  }
  function advance(){
    if(!active||gameOver||(players.length===1&&currentTeam!=='PLAYER')||(players.length>1&&!OnlineMatch.isHost)||turnNumber<=lastAdvance)return;
    lastAdvance=turnNumber;check();if(gameOver)return;
    ActionEffects.reset();selectedUnit=null;closeSpawnMenu();
    // Discard the back row, then move every surviving tile, town and unit together.
    terrain=[...rowTerrain(wave),...terrain.slice(0,COLS*19)];
    settlements=[...Array(COLS).fill(null),...settlements.slice(0,COLS*19)];
    units=units.filter(u=>u.hp>0&&u.row<19);for(const u of units)u.row++;
    wave++;spawnWave();check();refresh();
  }
  function exitToBattle(){const data=previousScenario;stop();previousScenario=null;if(data){applyLevelData(clonePlain(data));captureScenarioSnapshot();}else setupGame();}
  document.addEventListener('DOMContentLoaded',()=>{
    $('menuEndlessBtn').onclick=()=>{$('endlessMenu').hidden=false;$('endlessDifficulty').focus();};
    $('endlessCancel').onclick=()=>{$('endlessMenu').hidden=true;};
    $('endlessStart').onclick=()=>start($('endlessDifficulty').value);
    $('endlessExit').onclick=()=>{if(players.length>1){OnlineMatch.returnLobby();return;}gameOver=true;activeAITurn=null;clearTimeout(aiTurnTimeoutId);$('mainMenu').classList.remove('hidden');};
    for(const event of ['pointerdown','pointerup','mousedown','mouseup','click','keydown','keyup'])$('endlessMenu').addEventListener(event,e=>e.stopPropagation());
    $('endlessMenu').addEventListener('keydown',e=>{if(e.key==='Escape')$('endlessMenu').hidden=true;});
    $('menuPlayBtn').addEventListener('click',()=>{if(active)exitToBattle();},true);
  });
  function snapshot(){return active?{difficulty,seed,wave,lastAdvance,players:[...players],lossReason}:null;}
  function restore(s){if(!s){stop();return;}({difficulty,seed,wave,lastAdvance,players,lossReason}=s);active=true;refresh();}
  return {snapshot,restore,get players(){return [...players];},get lossReason(){return lossReason;},get active(){return active;},get wave(){return wave;},get difficulty(){return difficulty;},get seed(){return seed;},start,stop,advance,check,refresh,restart:()=>start(difficulty,seed),rowTerrain,waveNames};
})();
