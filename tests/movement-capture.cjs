const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const bootstrap=fs.readFileSync('tests/ai-commander.cjs','utf8').split('reset();let soldier=')[0];
const harness={require,console};vm.createContext(harness);
vm.runInContext(bootstrap+';this.fixture={ctx,run,unit,reset};',harness);
const {ctx,run,unit,reset}=harness.fixture;
for(const f of ['territory','move-undo','learning-ai'])vm.runInContext(fs.readFileSync(`js/systems/${f}.js`,'utf8'),ctx);
vm.runInContext(fs.readFileSync('js/input/mouse-actions.js','utf8'),ctx);
const undo=run('MoveUndo'),territory=run('Territory');
Object.assign(ctx,{opponentType:'AI',gameMode:'vs-ai',buildMode:false,SHIFT:16,keyIsDown:()=>false,createOptimisticUpdate:()=> 'move-1',closeSpawnMenu(){},LEARNING_AI:{enabled:true,currentGameRecord:{moves:[]}}});
run('addAIMessage=()=>{};getActiveTeams=()=>["PLAYER","AI"];');
const record=ctx.recordHumanAction;
for(const owner of [undefined,'PLAYER',null,'AI']) {
 reset();territory.reset();undo.clear();ctx.currentTeam='PLAYER';
 const u=unit('Soldier',0,0,'PLAYER');ctx.units=[u];ctx.selectedUnit=u;
 if(owner!==undefined)ctx.settlements[1]={type:'TOWN',owner};
 const rp=run('getResearchPoints("PLAYER")');let posted=0;
 ctx.updateUI=()=>{undo.canUndo();}; // Capture rewards refresh the UI before finish().
 ctx.postGameState=()=>{posted++;if(owner!==undefined)assert.equal(ctx.settlements[1].owner,'PLAYER','ownership changes before sync');};
 ctx.handleGridClick(1,0);
 assert.equal(u.col,1);assert(undo.canUndo(),'every ordinary or settlement move is undoable');assert(posted);
 const action=ctx.LEARNING_AI.currentGameRecord.moves.at(-1);
 assert.equal(action.actionData.fromCol,0);assert.equal(action.actionData.distance,1);
 if(owner!==undefined)assert.equal(ctx.settlements[1].owner,'PLAYER','capture is immediate');
 ctx.postGameState=()=>{};assert(undo.undo());assert.equal(u.col,0);assert.equal(u.hasMoved,false);
 if(owner!==undefined)assert.equal(ctx.settlements[1].owner,owner);
 assert.equal(run('getResearchPoints("PLAYER")'),rp,'undo restores capture rewards');
 // Optional learning failures must not break committed movement or capture.
 ctx.recordHumanAction=()=>{throw Error('storage unavailable');};ctx.handleGridClick(1,0);
 assert(undo.canUndo());if(owner!==undefined)assert.equal(ctx.settlements[1].owner,'PLAYER');
 assert(undo.undo());ctx.recordHumanAction=record;
}
console.log('Real click movement: ordinary/owned/neutral/enemy destinations, immediate capture, synchronous UI refresh, learning failures, undo and research reward rollback pass.');
