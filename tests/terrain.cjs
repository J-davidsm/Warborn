const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const sources=[];
const ctx=vm.createContext({console,Image:class {set src(v){sources.push(v)}},normalizeTerrainType:t=>t&&String(t).toUpperCase(),terrainHash:(c,r,s)=>((Math.imul(c+1,374761393)^Math.imul(r+1,668265263)^s)>>>0)});
vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/rendering/terrain-blend.js'),'utf8'),ctx);
assert.equal(sources.length,54);assert.equal(new Set(sources).size,50);
assert.equal(ctx.terrainV2FadeWeight('GRASS',0),1);
assert.equal(ctx.terrainV2FadeWeight('WOODS',1.62),0);
assert(ctx.terrainV2FadeWeight('MOUNTAIN',1.2)>0.25,'nature biomes should crossfade broadly beyond their hex edge');
assert(ctx.terrainV2FadeWeight('BRIDGE',1.2)<ctx.terrainV2FadeWeight('GRASS',1.2),'built details should keep a tighter edge');
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
const adjacent=Array(81).fill('GRASS');for(let col=2;col<=6;col++)adjacent[4*9+col]='BRIDGE';
const joined=Array.from({length:5},(_,i)=>ctx.terrainV2BridgeVariant(i+2,4,9,9,false,adjacent));assert.equal(new Set(joined).size,1,'adjacent bridges share an image');
for(let col=2;col<=6;col++)assert.equal(ctx.terrainV2BridgeAngle(col,4,9,9,false,adjacent),0,'bridge line stays straight without water neighbors');

// Offset-column rows must form a connected zigzag, not disjoint horizontal stamps.
for(const hex of [true,false])for(const parity of [0,1]){
 const map=Array(81).fill('WATER');
 const path=[[2,4],[3,4],[4,4],[4,5],[5,5]];
 for(const [c,r] of path)map[r*9+c]='BRIDGE';
 for(const [c,r] of path){
  const links=ctx.terrainV2BridgeConnections(c,r,9,9,hex,map,parity);
  for(const link of links.filter(l=>l.to.type==='BRIDGE')){
   const back=ctx.terrainV2BridgeConnections(link.to.c,link.to.r,9,9,hex,map,parity);
   assert(back.some(l=>l.to.x===link.from.x&&l.to.y===link.from.y&&l.from.x===link.to.x&&l.from.y===link.to.y),'every bridge joins exactly at the adjacent deck');
   if(hex&&link.to.c!==c)assert.notEqual(link.from.y,link.to.y,'cross-column deck follows the staggered hex height');
  }
 }
}
console.log('Bridge endpoints join on square, staggered hex, bends and shifted camera parity.');
const straightMap=Array(81).fill('WATER');for(let c=1;c<8;c++)straightMap[4*9+c]='BRIDGE';
const paths=ctx.terrainV2BridgePaths(9,9,true,straightMap);
assert.equal(paths.length,1,'one continuous deck instead of overlapping segments');
assert(paths[0].points.every(p=>Math.abs(p.y-paths[0].points[0].y)<1e-8),'horizontal crossing stays straight despite staggered centers');
assert.equal(paths[0].points.length,2,'one start and end for the stretched image');
const solitary=Array(81).fill('WATER');solitary[40]='BRIDGE';assert.equal(ctx.terrainV2BridgePaths(9,9,true,solitary).length,1,'single bridge tile spans its water hex');

for(const count of [1,2,3,4,5,6])for(const parity of [0,1]){
 const map=Array(100).fill('WATER');for(let c=2;c<2+count;c++)map[40+c]='BRIDGE';
 const spans=ctx.terrainV2BridgePaths(10,10,true,map,parity);assert.equal(spans.length,1);
 const [a,b]=spans[0].points;assert(Math.abs(a.y-b.y)<1e-8,'odd and even horizontal runs stay level');
 assert(Math.abs(b.x-a.x-(count===1?2:1.5*(count-1)+1.5))<1e-7,'endpoints reach the outer hex edges');
}
