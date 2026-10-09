const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{client,tick,peers}=require('./multiplayer-harness.cjs');
const h=client('Host'),g=client('Guest');let now=Date.now();
for(const p of [h,g]){
 p.el('ruinChoice').remove=()=>{};
 p.ctx.isFortressUnit=()=>false;
 p.ctx.currentAIPlayers=0;
 p.ctx.canAttack=(a,b)=>a!==b;
 p.ctx.Date=class extends Date{static now(){return now;}};
 Object.assign(p.ctx,{Math,SETTLEMENTS:{CITY:{healPct:.1}},TERRAIN:{},cleanupExpiredTradeProposals(){},isDiplomacyActive:()=>false,getActiveTeams:()=>['PLAYER','PLAYER2'],captureSettlementsWithUnits(){},grantIncomeForTeam(){p.income=(p.income||0)+1;},advanceDoctrineResearch(){p.research=(p.research||0)+1;},autoFlee(){},checkEndGame(){},getLocalPlayableTeam:()=>p.run('OnlineMatch.localTeam')});
 p.ctx.postGameState=()=>p.run('OnlineMatch.publish()');vm.runInContext(fs.readFileSync('js/systems/combat-turns.js','utf8'),p.ctx);
 p.ctx.autoFlee=()=>{};
}
h.el('lobbyCreate').onclick();tick();g.run(`OnlineMatch.join('${h.el('lobbyRoom').textContent}')`);tick();h.el('lobbyReady').onclick();g.el('lobbyReady').onclick();tick();h.el('lobbyStart').onclick();tick();
if(h.ctx.currentTeam!=='PLAYER2'){h.ctx.currentTeam='PLAYER2';h.ctx.currentTurnIndex=h.ctx.turnOrder.indexOf('PLAYER2');h.run('OnlineMatch.publish()');tick();}
const before=h.ctx.currentTeam;now+=120001;h.intervals.at(-1)();tick();assert.notEqual(h.ctx.currentTeam,before);assert.equal(g.ctx.currentTeam,h.ctx.currentTeam);assert.equal(h.income,1);assert.equal(h.research,1,'expiry executes research exactly once');
assert(h.ctx.units.filter(u=>u.team===h.ctx.currentTeam).every(u=>u.hasMoved===false&&u.hasActed===false));
h.intervals.at(-1)();tick();assert.equal(h.income,1);now+=119000;h.intervals.at(-1)();tick();assert.equal(h.income,1);
now+=1001;h.intervals.at(-1)();tick();assert.equal(h.income,2);assert.equal(h.research,2);
console.log('Real endTurn pipeline executes guest/host expiry once, preserves income/research, resets next army and synchronizes both peers.');
