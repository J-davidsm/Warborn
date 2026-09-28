// Small, handcrafted battles. Restart uses the normal scenario snapshot.
function createIntroScenario(training = false) {
  const cols = 12, rows = 10;
  const data = {mapSize:{cols,rows}, aiPlayerCount:1, terrain:Array(cols*rows).fill('GRASS'),
    settlements:Array(cols*rows).fill(null), units:[], diplomacy:{},
    startingResources:{PLAYER:{gold:0,materials:0},AI:{gold:0,materials:0}},
    research:{PLAYER:['Soldier','Spearman','Archer','Cleric'],AI:['Soldier','Spearman','Archer']},
    victoryCondition:{type:'CAPTURE_TOWN',holdCol:9,holdRow:4,targetTeam:'AI',targetName:training?'Training Outpost':'Greenbank',training}};
  const ground=(type,tiles)=>tiles.forEach(([c,r])=>data.terrain[r*cols+c]=type);
  ground('WATER',Array.from({length:rows},(_,r)=>[6,r]));
  ground('BRIDGE',[[6,4],[6,7]]);
  ground('WOODS',[[3,1],[4,1],[3,2],[4,2],[8,7],[9,7]]);
  ground('MOUNTAIN',[[8,1],[9,1],[10,1],[1,8],[2,8]]);
  ground('SWAMP',[[4,7],[5,7],[5,8]]);
  ground('FARM',[[2,4],[3,4],[9,5]]);
  ground('FOUNTAIN',[[3,6]]);
  if(training)ground('DESERT',[[9,8],[10,8]]);
  const town=(c,r,type,owner)=>data.settlements[r*cols+c]={type,owner};
  town(2,5,'VILLAGE','PLAYER');town(2,7,'HAMLET','PLAYER');
  town(9,4,'VILLAGE','AI');town(9,6,'HAMLET',training?null:'AI');town(4,4,'HAMLET',null);
  const add=(name,team,col,row,extra={})=>data.units.push({name,team,col,row,...extra});
  add('Crown','PLAYER',1,5);add('Soldier','PLAYER',2,5);
  add('Spearman','PLAYER',3,5);add('Archer','PLAYER',2,3);
  add('Knight','PLAYER',3,3);add('Cleric','PLAYER',2,6);
  if(training){
    add('Soldier','PLAYER',3,6,{hp:25});add('Stockade','PLAYER',1,7);
    add('Soldier','AI',9,4);add('Archer','AI',10,5);
  }else{
    add('Crown','AI',10,4);add('Soldier','AI',9,4);
    add('Spearman','AI',8,4);add('Archer','AI',9,3);add('Knight','AI',8,6);
  }
  return data;
}

function startIntroScenario(training = false) {
  if(typeof OnlineMatch!=='undefined'&&OnlineMatch.active)return;
  if(typeof BattleGuide!=='undefined')BattleGuide.dismiss();
  campaignMode.active=false;lastPlayedSavedLevelIndex=null;
  opponentType='AI';gameMode='vs-ai';isEditorMode=false;
  document.getElementById('gameModeSelect').value='vs-ai';
  document.getElementById('campaignPage')?.classList.remove('visible');
  document.getElementById('scenarioWorkshop')?.classList.remove('visible');
  applyLevelData(createIntroScenario(training));
  captureScenarioSnapshot();
  document.getElementById('mainMenu')?.classList.add('hidden');
  if(typeof CommandMenu!=='undefined')CommandMenu.close();
  fitMapToViewport();updateUI();
  gameInputBlockedUntil=Date.now()+500;
  try{SoundManager.startBackgroundMusic();}catch(e){}
  if(training)BattleGuide.start();
}
