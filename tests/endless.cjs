const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const els={},el=id=>els[id]??={style:{},hidden:true,disabled:false,value:'medium',classList:{add(){},remove(){}},focus(){},addEventListener(){},getBoundingClientRect:()=>({left:900})};
let unitId=0;
const c={console,Math,Date,clearTimeout,document:{body:{classList:{toggle(){}}},getElementById:el,addEventListener(){}},activeScenarioSnapshot:{name:'previous'},clonePlain:x=>JSON.parse(JSON.stringify(x)),campaignMode:{active:false},opponentType:'AI',currentAIPlayers:1,isEditorMode:false,currentTeam:'PLAYER',turnNumber:1,COLS:10,ROWS:20,BOARD_SIZE:600,height:900,minZoom:.2,resources:{},researchedUnits:{},tradeProposals:[],communicationLockouts:{},terrain:[],settlements:[],units:[],activeAITurn:null,aiTurnTimeoutId:null,selectedUnit:null,gameOver:false,
 setupGame(){c.units=[];},makeUnit:(name,team,col,row)=>({id:String(++unitId),name,team,col,row,hp:100,maxHp:100}),resetStartingEconomy(){c.resources={PLAYER:{gold:0,materials:0},AI:{gold:0,materials:0}};},createDefaultWarDiplomacy:()=>({}),normalizeVictoryCondition:x=>x,updateHexSize(){},resizeGameCanvas(){},calculateTurnOrder(){},hideEndScreen(){},closeSpawnMenu(){},closeTradeProposalModal(){},updateTeamSelector(){},applyVictoryConditionToUI(){},updateUI(){},captureScenarioSnapshot(){c.activeScenarioSnapshot={name:'endless'};},getMapWorldBounds:()=>({x:0,y:0,width:600,height:1200}),getMapOrigin:()=>({x:0,y:0}),clampPanToMap(){},ActionEffects:{reset(){}},showEndScreen:r=>{c.result=r;}};
vm.createContext(c);vm.runInContext(fs.readFileSync('js/systems/endless.js','utf8'),c);const run=s=>vm.runInContext(s,c);
for(const difficulty of ['easy','medium','hard','impossible']){
 run(`Endless.start('${difficulty}',42)`);assert.equal(c.COLS,10);assert.equal(c.ROWS,20);assert.equal(c.terrain.length,200);assert.equal(c.settlements.length,200);assert.equal(c.resources.PLAYER.gold,0);assert.equal(c.resources.AI.materials,0);assert(c.settlements.some(s=>s?.owner==='PLAYER'));assert(c.settlements.some(s=>s?.owner==='AI'));
 if(difficulty==='easy'){assert.equal(c.units.filter(u=>u.team==='PLAYER').length,6);assert(c.researchedUnits.PLAYER.has('Cleric'));assert.equal(run('Endless.waveNames(22).length'),1);assert.equal(run('Endless.waveNames(23).length'),2);for(let n=1;n<36;n++)assert(!run(`Endless.waveNames(${n})`).includes('Dragon'));assert.equal(run('Endless.waveNames(200).length'),3);}
 const names=run('Endless.waveNames(1)');assert.equal(names.length,{easy:1,medium:1,hard:2,impossible:3}[difficulty]);
 const townIndex=c.settlements.findIndex(s=>s?.owner==='PLAYER'),oldTown=c.settlements[townIndex],oldTerrain=c.terrain[105],survivor=c.units.find(u=>u.team==='PLAYER'),oldRow=survivor.row;c.units.push(c.makeUnit('Soldier','PLAYER',3,19));const doomed=c.units.at(-1).id;
 c.turnNumber=2;run('Endless.advance()');assert.equal(run('Endless.wave'),2);assert.equal(survivor.row,oldRow+1);assert(!c.units.some(u=>u.id===doomed));assert.equal(c.settlements[townIndex+10],oldTown);assert.equal(c.terrain[115],oldTerrain);assert(c.units.some(u=>u.team==='AI'&&u.row===0));run('Endless.advance()');assert.equal(run('Endless.wave'),2,'advance only once per round');
 for(let round=3;round<65;round++){
  c.units=c.units.filter(u=>u.team==='PLAYER');c.units.forEach((u,i)=>u.row=10+i);c.turnNumber=round;run('Endless.advance()');assert(!c.gameOver);assert.equal(c.terrain.length,200);assert.equal(c.settlements.length,200);
  for(let row=0;row<20;row++){assert.equal(c.terrain[row*10],'WATER');assert.equal(c.terrain[row*10+9],'WATER');assert.equal(c.terrain[row*10+4],'GRASS');}
  assert(c.units.some(u=>u.team==='AI'&&u.row===0));assert(c.units.every(u=>u.col>0&&u.col<9&&u.row>=0&&u.row<20));assert.equal(new Set(c.units.map(u=>u.row*10+u.col)).size,c.units.length);
 }
 assert(c.settlements.some(s=>s?.owner==='AI'),'towns keep arriving');
 run('Endless.restart()');assert.equal(run('Endless.wave'),1);assert.equal(run('Endless.difficulty'),difficulty);assert.equal(run('Endless.seed'),42);assert.equal(c.resources.PLAYER.gold,0);
 c.units.push(c.makeUnit('Soldier','AI',5,19));run('Endless.check()');assert(c.gameOver);assert.match(c.result.explanation,/back edge/);
 run('Endless.restart()');c.units=c.units.filter(u=>u.team==='PLAYER');run('Endless.check()');assert(!c.gameOver,'clearing enemies does not win endless');
 c.units.push(c.makeUnit('Archer','AI',6,18));c.turnNumber=2;run('Endless.advance()');assert(c.gameOver,'scrolling an enemy onto the back edge loses');
 run('Endless.restart()');c.units=[];c.settlements.fill(null);run('Endless.check()');assert(c.gameOver,'army and settlement elimination loses');
}
console.log('All four Endless difficulties: 10x20 borders, zero starts, escalating waves, recurring towns, coherent row shifts, unit removal, one advance per round, defeat rules and seeded restart pass.');
