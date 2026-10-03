const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const spacing=require('../js/core/settlement-spacing.js');
const c={console:{log(){}},Date,SettlementSpacing:spacing,COLS:9,ROWS:9,settlements:Array(81).fill(null),isEditorMode:true,placingUnitType:null,placingUnitTeam:null,placingTerrain:null,placingSettlement:'CITY',selectedTeam:'PLAYER',useHexGrid:false,lastEditorAction:{time:0},EDITOR_DEDUP_MS:0,updateUI(){},showPopup(){c.warned=true;}};
vm.createContext(c);vm.runInContext(fs.readFileSync('js/ui/editor-controls.js','utf8'),c);
for(const hex of [false,true])for(const col of [0,3,4,8]){
 c.useHexGrid=hex;c.settlements.fill(null);vm.runInContext("placingSettlement='CITY'",c);c.selectedTeam='PLAYER';c.handleEditorClick(col,4);
 for(const p of spacing.neighbors(col,4,hex).filter(p=>p.col>=0&&p.col<9))for(const type of ['HAMLET','VILLAGE','CITY','PORT']){
  vm.runInContext(`placingSettlement=${JSON.stringify(type)}`,c);c.selectedTeam='AI3';c.warned=false;c.handleEditorClick(p.col,p.row);
  assert.equal(c.settlements[p.row*9+p.col],null,'all types/owners blocked on every neighboring tile');assert(c.warned);
 }
 c.handleEditorClick(col,6);assert(c.settlements[6*9+col],'one tile gap allowed');
 vm.runInContext("placingSettlement='VILLAGE'",c);c.handleEditorClick(col,4);assert.equal(c.settlements[4*9+col].type,'VILLAGE','replacement on same tile permitted');
 vm.runInContext("placingSettlement='CLEAR'",c);c.handleEditorClick(col,4);assert.equal(c.settlements[4*9+col],null,'removal permitted');
}
function check(board,cols,rows,hex){for(let i=0;i<board.length;i++)if(board[i])assert(spacing.canPlace(board,cols,rows,i%cols,Math.floor(i/cols),hex),'adjacent settlements at '+i);}
const fair=require('../js/net/fair-map.js');
for(let seed=0;seed<250;seed++)for(const n of [2,3,4]){const m=fair.generateForPlayers(seed,n);check(m.settlements,m.cols,m.rows,true);}
const ctx={console,Math,Date,aiTeamNames:['AI','AI2','AI3','AI4'],isAITeam:t=>t.startsWith('AI'),units:[],currentVictoryCondition:{},getActiveTeams:()=>['PLAYER','AI','AI2'],DEFAULT_VICTORY_CONDITION:{type:'ANNIHILATE_ALL'},getTeamDisplayName:t=>t,SettlementSpacing:spacing};vm.createContext(ctx);
for(const f of ['js/systems/campaign.js','js/data/campaign-catalog.js','js/core/intro-scenarios.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
for(const chapter of ctx.buildCampaignCatalog())for(const s of chapter.scenarios){const {cols,rows}=s.mapSize,board=Array(cols*rows).fill(null);for(const t of s.settlements)board[t.row*cols+t.col]=t;check(board,cols,rows,false);check(board,cols,rows,true);}
for(const training of [false,true]){const s=ctx.createIntroScenario(training);check(s.settlements,s.mapSize.cols,s.mapSize.rows,false);check(s.settlements,s.mapSize.cols,s.mapSize.rows,true);}
console.log('Settlement spacing: square diagonals, six hex neighbors, both column parities, edges, all types/owners, replacement/removal; 750 multiplayer maps and all authored scenarios pass.');
