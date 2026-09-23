const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

function game({terrain,units}) {
  const ctx={COLS:terrain.length,ROWS:1,terrain,units,TERRAIN:{WATER:{waterOnly:true}},useHexGrid:false,abs:Math.abs,console:{log(){}},getHexNeighbors:()=>[]};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(require.resolve('../js/systems/mechanics.js'),'utf8'),ctx);
  return ctx;
}
function unit(id,col,isWaterUnit=false) { return {id,name:'Soldier',team:id[0]==='p'?'PLAYER':'PLAYER2',col,row:0,move:3,hp:100,isWaterUnit}; }

let p=unit('player',0),ctx=game({terrain:['GRASS','WATER','GRASS'],units:[p]});
assert.equal(ctx.canMoveTo(p,2,0),false,'land units cannot cross water');
ctx=game({terrain:['GRASS','BRIDGE','GRASS'],units:[p]});
assert.equal(ctx.canMoveTo(p,2,0),true,'land units can cross a bridge');
let ship=unit('ship',0,true);ship.name='Sloop';ctx=game({terrain:['WATER','WATER','WATER'],units:[ship]});
assert.equal(ctx.canMoveTo(ship,2,0),true,'water units can navigate water');
ctx=game({terrain:['WATER','WATER','GRASS'],units:[ship]});
assert.equal(ctx.canMoveTo(ship,2,0),false,'water units cannot use land shortcuts');
p=unit('player',0);const enemy=unit('enemy',1);ctx=game({terrain:['GRASS','GRASS','GRASS'],units:[p,enemy]});
assert.equal(ctx.canMoveTo(p,1,0),false,'an occupied enemy tile is an attack target, not a move target');
assert.equal(ctx.canMoveTo(p,2,0),false,'units cannot pass through enemy units');
for(const team of ['PLAYER','AI']){
  p=unit('mover',0);p.team=team;
  const friend=unit('friend',1);friend.team=team;
  ctx=game({terrain:['GRASS','GRASS','GRASS'],units:[p,friend]});
  assert.equal(ctx.canMoveTo(p,1,0),false,'cannot finish on own unit');
  assert.equal(ctx.canMoveTo(p,2,0),true,'player and AI can pass through own units');
  assert.equal(ctx.findMovementPath(p,2,0)[1].col,1,'animation path includes own occupied tile');
  ctx.terrain[1]='WATER';assert.equal(ctx.canMoveTo(p,2,0),false,'own units do not bypass terrain restrictions');
}
console.log('Land/water restrictions, bridge crossings, and occupied-unit path blocking pass.');
// A detour must animate along adjacent safe tiles, not straight across water.
ctx=game({terrain:Array(9).fill(null),units:[p]});ctx.COLS=3;ctx.ROWS=3;p.col=0;p.row=1;p.move=4;ctx.terrain[4]='WATER';
const route=ctx.findMovementPath(p,2,1);
assert.equal(route.length,5);assert(route.every(t=>ctx.terrain[t.row*3+t.col]!=='WATER'));
for(let i=1;i<route.length;i++)assert.equal(Math.abs(route[i].col-route[i-1].col)+Math.abs(route[i].row-route[i-1].row),1);
ctx.window={};ctx.crypto=require('node:crypto').webcrypto;ctx.performance={now:()=>0};ctx.getTileCenterLocal=(col,row)=>({x:col,y:row});
vm.runInContext(fs.readFileSync(require.resolve('../js/rendering/action-effects.js'),'utf8'),ctx);
vm.runInContext('ActionEffects.move(units[0],2,1)',ctx);p.col=2;p.row=1;
ctx.sampleTime=225;
const sample=vm.runInContext('ActionEffects.position(units[0],p=>({x:p.col,y:p.row}),sampleTime)',ctx);
assert.equal(sample.x,(route[1].col+route[2].col)/2);assert.equal(sample.y,(route[1].row+route[2].row)/2);
ctx.sampleTime=1000;assert.equal(vm.runInContext('ActionEffects.position(units[0],p=>({x:p.col,y:p.row}),sampleTime).x',ctx),2);
console.log('Movement animation follows the safe detour and finishes at the destination.');
