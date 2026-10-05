// Secret observer mode: a fast, hands-off AI sandbox entered with E at the menu.
const WatchGame = (() => {
  const teamAt = i => i === 0 ? 'AI' : `AI${i + 1}`;
  const colors = ['#e95555','#45d985','#e6d34f','#c86bea','#43c6e8','#f39b4a','#8a9cf5','#d66d9a','#78c85c','#f06f5c','#55b9d6','#b78be5','#d0b34d','#52d1a8','#ed7baf','#7792dc','#b4d25a','#d89555','#66c9c9','#c67cd7'];
  function notify(text){if(typeof BattleGuide!=='undefined'&&BattleGuide.notify)BattleGuide.notify(text);else if(typeof showPopup==='function')showPopup('Watch game',text,'info');}
  function buildRelations(){
    let box=document.getElementById('watchRelations');
    if(!box){box=document.createElement('section');box.id='watchRelations';box.className='watch-relations';document.body.appendChild(box);}
    const teams=getActiveTeams().filter(isAITeam); const rows=[];
    for(let i=0;i<teams.length;i++)for(let j=i+1;j<teams.length;j++){
      const a=teams[i],b=teams[j],trust=Math.round(((getTrust(a,b)||0)+(getTrust(b,a)||0))/2);
      const treaty=(diplomacy.treaties||[]).find(t=>t.active&&t.participants.includes(a)&&t.participants.includes(b));
      rows.push(`<div><b style="color:${getTeamColorHex(a)}">${a}</b> ↔ <b style="color:${getTeamColorHex(b)}">${b}</b><span>${treaty?String(treaty.type).replaceAll('_',' '):trust>15?'Friendly':trust<-35?'Hostile':'Uneasy'}</span></div>`);
    }
    box.innerHTML=`<header><strong>AI diplomatic relations</strong><button type="button" id="watchRelationsClose">Close</button></header>${rows.join('')||'<p>No active AI relations yet.</p>'}`;
    box.hidden=false;box.querySelector('#watchRelationsClose').onclick=()=>{box.hidden=true;};
  }
  function controls(){
    let bar=document.getElementById('watchGameBar'); if(bar)return bar;
    bar=document.createElement('div');bar.id='watchGameBar';bar.innerHTML='<strong>WATCH GAME</strong><button id="watchPauseBtn" type="button">Pause</button><label>AI delay <input id="watchDelay" type="range" min="0" max="100" value="55" step="1"><span id="watchDelayLabel">0.1s</span></label><button id="watchRelationsBtn" type="button">Relations</button><button id="watchExitBtn" type="button">Menu</button>';document.body.appendChild(bar);
    const range=bar.querySelector('#watchDelay'),label=bar.querySelector('#watchDelayLabel');
    const update=()=>{const v=Number(range.value);watchGameDelay=v===100?0:Math.round(100+(100-v)*2);label.textContent=watchGameDelay===0?'instant':`${(watchGameDelay/1000).toFixed(1)}s`;};
    range.oninput=update;bar.querySelector('#watchPauseBtn').onclick=()=>togglePause();bar.querySelector('#watchRelationsBtn').onclick=buildRelations;bar.querySelector('#watchExitBtn').onclick=stop;update();return bar;
  }
  function start(){
    if(typeof document==='undefined'||document.getElementById('mainMenu')?.classList.contains('hidden'))return false;
    watchGameMode=true;watchGamePaused=false;gameMode='watch';opponentType='AI';currentAIPlayers=20;maxAIPlayers=Math.max(maxAIPlayers,20);aiTeamNames=Array.from({length:20},(_,i)=>teamAt(i));
    COLS=30;ROWS=24;TILE=BOARD_SIZE/COLS;cameraX=0;cameraY=0;terrain=Array(COLS*ROWS).fill(null);settlements=Array(COLS*ROWS).fill(null);units=[];resources={};startingResources={};doubleUpkeepMode=false;hyperAggressiveMode=false;
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const n=(c*17+r*31)%29;terrain[r*COLS+c]=n===0?'WOODS':n===1?'MOUNTAIN':n===2?'DESERT':null;}
    aiTeamNames.forEach((team,i)=>{const side=i%4,ring=Math.floor(i/4),col=2+side*8+(ring%2),row=2+Math.floor(i/4)*4+(side%2),p={col:Math.min(COLS-3,col),row:Math.min(ROWS-3,row)};settlements[p.row*COLS+p.col]={type:'VILLAGE',owner:team};units.push(makeUnit('Knight',team,p.col,p.row),makeUnit('Soldier',team,p.col+1,p.row),makeUnit('Archer',team,p.col,p.row+1));});
    turnOrder=aiTeamNames.slice();currentTurnIndex=0;currentTeam=turnOrder[0];turnNumber=1;currentVictoryCondition={...DEFAULT_VICTORY_CONDITION,type:'WATCH'};gameOver=false;endScreenShown=false;gameEndResult=null;selectedUnit=null;isEditorMode=false;if(typeof hideEndScreen==='function')hideEndScreen();
    if(typeof initializeResourcesForActiveTeams==='function')initializeResourcesForActiveTeams();if(typeof resetResearch==='function')resetResearch(turnOrder);if(typeof initializeDiplomacy==='function')initializeDiplomacy();if(typeof Territory!=='undefined')Territory.reset();
    document.getElementById('mainMenu').classList.add('hidden');document.body.classList.add('watch-mode');controls();updateUI();notify('Watch game started. Press Pause to stop the simulation.');setTimeout(()=>{if(!watchGamePaused)aiTakeTurn(currentTeam);},50);return true;
  }
  function togglePause(){watchGamePaused=!watchGamePaused;const b=document.getElementById('watchPauseBtn');if(b)b.textContent=watchGamePaused?'Unpause':'Pause';notify(watchGamePaused?'Watch game paused.':'Watch game resumed.');if(!watchGamePaused&&isAITeam(currentTeam))setTimeout(()=>aiTakeTurn(currentTeam),0);}
  function stop(){watchGameMode=false;watchGamePaused=false;document.body.classList.remove('watch-mode');document.getElementById('watchGameBar')?.remove();document.getElementById('watchRelations')?.remove();gameMode='vs-ai';opponentType='AI';currentAIPlayers=1;aiTeamNames=['AI','AI2','AI3','AI4'];document.getElementById('mainMenu')?.classList.remove('hidden');if(typeof switchGameMode==='function')switchGameMode('vs-ai');}
  return {start,stop,togglePause,buildRelations};
})();

// p5 does not receive keyboard focus while the full-screen menu is open, so
// keep the observer shortcut available at the document level as well.
if(typeof document!=='undefined')document.addEventListener('keydown',event=>{
  if((event.key==='e'||event.key==='E')&&!document.getElementById('mainMenu')?.classList.contains('hidden')){event.preventDefault();WatchGame.start();}
});
