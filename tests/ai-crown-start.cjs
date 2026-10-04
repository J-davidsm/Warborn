const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={console:{log(){},warn(){},debug(){}},Math,Date,COLS:12,ROWS:8,terrain:Array(96).fill(null),settlements:Array(96).fill(null),units:[],useHexGrid:false,abs:Math.abs,min:Math.min,max:Math.max,floor:Math.floor,
 currentTeam:'AI',turnNumber:1,gameOver:false,isEditorMode:false,aiTurnTimeoutId:null,currentVictoryCondition:{type:'ANNIHILATE_ALL'},
 diplomacy:{warDeclarations:[],trust:{},personalities:{AI:'BALANCED'}},isDiplomacyActive:()=>false,hasTreaty:()=>false,
 updateUI(){},checkEndGame(){},showPopup(){},addAIMessage(){},window:{},ActionEffects:{move(){},damage(){}},
 isAITeam:t=>t.startsWith('AI'),clearTimeout(){},setTimeout:fn=>fn(),getHexNeighbors:()=>[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]],TERRAIN:{WATER:{waterOnly:true},MOUNTAIN:{blockedUnits:['Catapult']},WOODS:{assassinBonus:2,knightPenalty:.75}},
 campaignMode:{campaignData:{scenarios:[{difficulty:'Hard'}]},currentScenarioIndex:0}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/ui/popups-and-assets.js','utf8').match(/const SETTLEMENTS = \{[\s\S]*?\n\};/)[0],ctx);
for(const f of ['js/systems/economy-research.js','js/data/units-and-build.js','js/core/level-state.js','js/systems/mechanics.js','js/systems/diplomacy.js','js/systems/combat-turns.js','js/systems/settlements.js','js/systems/ai-logistics.js','js/systems/ai-turn.js','js/systems/ai-commander.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx),ai=run('AICommander');let next=0;
const grid=fs.readFileSync('js/core/state-and-grid.js','utf8');
for(const name of ['hexDistance','getHexNeighbors'])run(grid.match(new RegExp('function '+name+'\\([\\s\\S]*?\\n}'))[0]);
const unit=(name,col,row,team='AI')=>ctx.makeUnit(name,team,col,row,{id:'u'+(++next)});
const reset=()=>{ctx.COLS=12;ctx.ROWS=8;ctx.units=[];ctx.terrain=Array(96).fill(null);ctx.settlements=Array(96).fill(null);ctx.currentVictoryCondition={type:'ANNIHILATE_ALL'};ctx.turnNumber=1;ctx.useHexGrid=false;ai.reset();run("resetResearch(['AI']);resources.AI={gold:0,materials:0};hasTreaty=()=>false;isDiplomacyActive=()=>false;");};

async function scenario(hex=false){
 reset();ctx.useHexGrid=hex;
 const teams=['PLAYER','AI','AI2','AI3'],corners=[[0,0],[11,0],[0,7],[11,7]];
 run("resetResearch(['PLAYER','AI','AI2','AI3'])");
 teams.forEach((team,i)=>{const [col,row]=corners[i];ctx.settlements[row*12+col]={owner:team,type:'HAMLET'};ctx.units.push(unit('Crown',col,row,team));run(`resources.${team}={gold:2,materials:0}`);});
 ctx.endTurn=()=>{};ctx.diplomacy.diplomaticHistory=[];ctx.diplomacy.reputation={};run('addAIMessage=()=>{}');
 // Exercise real turn scheduling, recruitment, legal moves, and commander groups.
 for(let turn=1;turn<=3;turn++){
  ctx.turnNumber=turn;
  for(const team of teams.slice(1)){
   ctx.currentTeam=team;
   for(const u of ctx.units.filter(u=>u.team===team)){u.hasMoved=false;u.hasActed=false;}
   run(`resources.${team}.gold+=2`);
   await ctx.aiTakeTurn(team);
   const [col,row]=corners[teams.indexOf(team)];
   assert(ctx.getUnitAt(col,row)?.team===team,'home always remains occupied');
   if(turn===1){
    assert(ctx.units.some(u=>u.team===team&&u.name!=='Crown'),'Crown-only kingdom recruits on its first funded turn');
    const crown=ctx.units.find(u=>u.team===team&&u.name==='Crown');
    assert.equal(ctx.aiThreat(crown,team),0,'Crown deploys safely');
    assert(ctx.aiDistance(crown,{col,row})<=1,'Crown remains next to its defender');
   }
  }
 }
 for(const team of teams.slice(1)){
  const [col,row]=corners[teams.indexOf(team)];
  assert(ctx.units.some(u=>u.team===team&&u.name!=='Crown'&&ctx.aiDistance(u,{col,row})>=3),'each AI advances troops beyond its home');
 }
}
(async()=>{
 await scenario();await scenario(true);
 reset();const crown=unit('Crown',0,0);ctx.units=[crown];ctx.settlements[0]={owner:'AI',type:'HAMLET'};
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.aiChoosePosition(crown))),{col:0,row:0},'no money means no unsupported departure');
 run('resources.AI={gold:10,materials:0}');ctx.terrain[1]='WATER';ctx.terrain[12]='WATER';
 assert.equal(ctx.aiChoosePosition(crown).col,0,'blocked Crown cannot move illegally');assert.equal(ctx.aiChoosePosition(crown).row,0);
 ctx.terrain.fill(null);ctx.units.push(unit('Dragon',2,1,'PLAYER'));
 assert.equal(ctx.aiCrownDeployment(crown),null,'deployment never exposes Crown to an enemy attack');
 console.log('Four-corner Crown starts recruit, retain garrisons, and advance on square and hex maps; unsafe, blocked, and unfunded deployments remain blocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
