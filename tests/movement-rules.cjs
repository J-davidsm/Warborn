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
let ship=unit('ship',0,true);ctx=game({terrain:['WATER','WATER','WATER'],units:[ship]});
assert.equal(ctx.canMoveTo(ship,2,0),true,'water units can navigate water');
ctx=game({terrain:['WATER','WATER','GRASS'],units:[ship]});
assert.equal(ctx.canMoveTo(ship,2,0),false,'water units cannot use land shortcuts');
p=unit('player',0);const enemy=unit('enemy',1);ctx=game({terrain:['GRASS','GRASS','GRASS'],units:[p,enemy]});
assert.equal(ctx.canMoveTo(p,1,0),false,'an occupied enemy tile is an attack target, not a move target');
assert.equal(ctx.canMoveTo(p,2,0),false,'units cannot pass through enemy units');
console.log('Land/water restrictions, bridge crossings, and occupied-unit path blocking pass.');
