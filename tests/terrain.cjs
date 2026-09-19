const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const sources=[];
const ctx=vm.createContext({console,Image:class {set src(v){sources.push(v)}},normalizeTerrainType:t=>t&&String(t).toUpperCase(),terrainHash:(c,r,s)=>((Math.imul(c+1,374761393)^Math.imul(r+1,668265263)^s)>>>0)});
vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/rendering/terrain-blend.js'),'utf8'),ctx);
assert.equal(sources.length,54);assert.equal(new Set(sources).size,54);
const variants=ctx.terrainV2Variants(50,50);
assert.equal(new Set(variants).size,6);
for(let r=0;r<50;r++)for(let c=0;c<50;c++){
 for(const [dc,dr] of [[1,0],[0,1],[1,1],[-1,1]]){
  if(c+dc>=0&&c+dc<50&&r+dr<50)assert.notEqual(variants[r*50+c],variants[(r+dr)*50+c+dc],`adjacent repetition at ${c},${r}`);
 }
}
function angleTest(name,hex,water,expected){
 const map=Array(81).fill(null);map[4*9+4]='BRIDGE';for(const [c,r] of water)map[r*9+c]='WATER';
 const angle=ctx.terrainV2BridgeAngle(4,4,9,9,hex,map)*180/Math.PI;
 const difference=Math.abs(((angle-expected+270)%180)-90);
 assert.ok(difference<0.01,`${name}: ${angle}, wanted ${expected}`);
 return {name,deckDegrees:angle};
}
const bridges=[
 angleTest('square north-south stream',false,[[4,3],[4,5]],0),
 angleTest('square east-west stream',false,[[3,4],[5,4]],90),
 angleTest('square diagonal stream',false,[[3,3],[5,5]],135),
 angleTest('hex north-south stream',true,[[4,3],[4,5]],0),
 angleTest('hex northeast-southwest stream',true,[[5,3],[3,4]],60),
 angleTest('hex northwest-southeast stream',true,[[3,3],[5,4]],120),
 angleTest('hex stream bend',true,[[4,3],[5,4]],150),
 angleTest('wide square vertical channel',false,[[4,2],[4,3],[4,5],[4,6],[3,3],[5,3],[3,5],[5,5]],0),
 angleTest('isolated bridge stable fallback',true,[],0)
];
console.log(JSON.stringify({assetReferences:sources.length,variants:6,adjacentPairs:'no repeats on 50x50',bridges},null,2));

const generated=require('../js/net/fair-map.js').generate('crossing');
const crossingAngles=[];
generated.terrain.forEach((t,i)=>{if(t==='BRIDGE')crossingAngles.push(ctx.terrainV2BridgeAngle(i%20,Math.floor(i/20),20,16,true,generated.terrain)*180/Math.PI);});
assert.equal(new Set(crossingAngles).size,1);
assert(crossingAngles.every(angle=>Math.abs(Math.sin(angle*Math.PI/180))<.27),'generated bridges cross the north-south river');
console.log('Connected generated bridges share an across-river orientation.');
