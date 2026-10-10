const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const sources=[];
const ctx=vm.createContext({console,Image:class {set src(v){sources.push(v)}},normalizeTerrainType:t=>t&&String(t).toUpperCase(),terrainHash:(c,r,s)=>((Math.imul(c+1,374761393)^Math.imul(r+1,668265263)^s)>>>0)});
vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/rendering/terrain-blend.js'),'utf8'),ctx);
assert.equal(sources.length,49);assert.equal(new Set(sources).size,49);
assert.deepEqual(sources.filter(s=>s.includes('bridge-')), ['assets/terrain/v3/bridge-stone.png']);
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
// Deck geometry follows the actual shared cell edges. This catches the old
// fixed-horizontal stamps (vertical crossings) and offset-row gaps (hex runs).
const epsilon=1e-8;
const close=(a,b,message)=>assert(Math.abs(a-b)<epsilon,`${message}: ${a} != ${b}`);
const key=(c,r)=>`${c},${r}`;
const point=(c,r,hex,parity)=>hex
 ? {x:1+1.5*c,y:Math.sqrt(3)*(r+.5*((c-parity)&1))+Math.sqrt(3)/2}
 : {x:2*c+1,y:2*r+1};
const directions=(c,hex,parity)=>!hex?[[1,0],[-1,0],[0,1],[0,-1]]:((c-parity)&1)
 ? [[1,1],[1,0],[0,-1],[-1,0],[-1,1],[0,1]]
 : [[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]];
const samePoint=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<epsilon;
function inwardTangent(tile,port){
 const path=tile.paths.find(p=>samePoint(p.from,port)||samePoint(p.to,port));
 assert(path,'each port is reached by a rendered deck path');
 return {x:path.control.x-port.x,y:path.control.y-port.y};
}
function checkDecks(name,cells,hex,parity=0,banks=[]){
 const cols=12,rows=12,map=Array(cols*rows).fill('WATER');
 for(const [c,r]of cells)map[r*cols+c]='BRIDGE';
 for(const [c,r]of banks)map[r*cols+c]='GRASS';
 const tiles=ctx.terrainV2BridgeTiles(cols,rows,hex,map,parity);
 assert.equal(tiles.length,cells.length,`${name}: exactly one tile for each bridge`);
 const byCell=new Map(tiles.map(tile=>[key(tile.c,tile.r),tile]));
 for(const [c,r]of cells){
  const tile=byCell.get(key(c,r));assert(tile,`${name}: bridge cell ${c},${r} exists`);
  const center=point(c,r,hex,parity);
  close(tile.center.x,center.x,`${name}: center X`);close(tile.center.y,center.y,`${name}: center Y`);
  assert(tile.ports.length>=2,`${name}: endpoints span the tile instead of ending at its center`);
  assert.equal(new Set(tile.ports.map(p=>`${p.x.toFixed(8)},${p.y.toFixed(8)}`)).size,tile.ports.length,`${name}: no duplicate ports`);
  const neighbors=directions(c,hex,parity).map(([dc,dr])=>({c:c+dc,r:r+dr,...point(c+dc,r+dr,hex,parity)}));
  for(const port of tile.ports){
   assert(neighbors.some(p=>samePoint(port,{x:(p.x+center.x)/2,y:(p.y+center.y)/2})),`${name}: port lies at a shared edge midpoint`);
   const tangent=inwardTangent(tile,port);
   close(tangent.x*(center.y-port.y)-tangent.y*(center.x-port.x),0,`${name}: deck meets edge normally`);
   assert(tangent.x*(center.x-port.x)+tangent.y*(center.y-port.y)>0,`${name}: tangent points into its own tile`);
  }
  const adjacent=neighbors.filter(p=>byCell.has(key(p.c,p.r)));
  for(const neighbor of adjacent){
   const ports=tile.ports.filter(p=>p.type==='BRIDGE'&&p.neighborC===neighbor.c&&p.neighborR===neighbor.r);
   assert.equal(ports.length,1,`${name}: one connection to each adjacent bridge`);
   const other=byCell.get(key(neighbor.c,neighbor.r));
   const reciprocal=other.ports.find(p=>p.type==='BRIDGE'&&p.neighborC===c&&p.neighborR===r);
   assert(reciprocal,`${name}: neighboring connection is reciprocal`);
   assert(samePoint(ports[0],reciprocal),`${name}: adjacent decks share an exact endpoint`);
   const a=inwardTangent(tile,ports[0]),b=inwardTangent(other,reciprocal);
   close(a.x*b.y-a.y*b.x,0,`${name}: adjoining tangents align`);
   assert(a.x*b.x+a.y*b.y<0,`${name}: adjoining deck tangents face opposite directions`);
  }
  assert.equal(tile.ports.filter(p=>p.type==='BRIDGE').length,adjacent.length,`${name}: no invented links across water`);
  if(adjacent.length>=2)assert.equal(tile.ports.length,adjacent.length,`${name}: interior tiles have no stray dead ends`);
  if(tile.ports.length===2)assert.equal(tile.paths.length,1,`${name}: a bend has one continuous curved path`);
  else assert.equal(tile.paths.length,tile.ports.length,`${name}: a junction reaches every connected edge`);
  // Quadratic interpolation must remain within the tile. A component-wide
  // straight image would cut across water in L shapes or sparse junctions.
  for(const path of tile.paths)for(let step=0;step<=20;step++){
   const t=step/20,u=1-t;
   const x=u*u*path.from.x+2*u*t*path.control.x+t*t*path.to.x-center.x;
   const y=u*u*path.from.y+2*u*t*path.control.y+t*t*path.to.y-center.y;
   const bound=hex?Math.sqrt(3)/2:1;
   const distance=hex?Math.max(Math.abs(y),Math.abs(Math.sqrt(3)/2*x+.5*y),Math.abs(Math.sqrt(3)/2*x-.5*y)):Math.max(Math.abs(x),Math.abs(y));
   assert(distance<=bound+epsilon,`${name}: deck remains within its bridge tile`);
  }
 }
 return {tiles,byCell};
}
for(const hex of [false,true])for(const parity of [0,1]){
 for(const count of [1,2,3,4,5,6]){
  checkDecks(`horizontal ${count} hex=${hex} parity=${parity}`,Array.from({length:count},(_,i)=>[i+2,4]),hex,parity);
  const vertical=checkDecks(`vertical ${count} hex=${hex} parity=${parity}`,Array.from({length:count},(_,i)=>[4,i+2]),hex,parity);
  if(count>=3)for(const tile of vertical.tiles.slice(1,-1))for(const port of tile.ports)close(port.x,tile.center.x,'vertical bridge remains vertical');
 }
 checkDecks(`bend hex=${hex} parity=${parity}`,[[2,4],[3,4],[4,4],[4,5],[4,6]],hex,parity);
 checkDecks(`T junction hex=${hex} parity=${parity}`,[[2,4],[3,4],[4,4],[5,4],[6,4],[4,5],[4,6]],hex,parity);
 checkDecks(`separate crossings hex=${hex} parity=${parity}`,[[1,1],[1,2],[8,7],[9,7]],hex,parity);
 checkDecks(`map edges hex=${hex} parity=${parity}`,[[0,0],[0,1],[1,0],[11,10],[11,11]],hex,parity);
 const center=[4,4],ring=directions(4,hex,parity).map(([dc,dr])=>[4+dc,4+dr]);
 const junction=checkDecks(`all-edge junction hex=${hex} parity=${parity}`,[center,...ring],hex,parity).byCell.get('4,4');
 assert.equal(junction.ports.length,hex?6:4,'all branches connect through the central junction');
}
const bankCase=checkDecks('dry banks at crossing ends',[[4,4],[5,4]],false,0,[[3,4],[6,4]]);
assert(bankCase.byCell.get('4,4').ports.some(p=>p.type==='GRASS'&&p.neighborC===3&&p.neighborR===4),'west endpoint lands on the dry bank');
assert(bankCase.byCell.get('5,4').ports.some(p=>p.type==='GRASS'&&p.neighborC===6&&p.neighborR===4),'east endpoint lands on the dry bank');
const isolated=checkDecks('isolated tile across a north-south stream',[[4,4]],false,0,[[3,4],[5,4]]).tiles[0];
assert(isolated.ports.every(p=>Math.abs(p.y-isolated.center.y)<epsilon),'isolated bridge crosses the river toward its banks');
console.log('Bridge decks connect horizontal, vertical, curved and junction crossings at shared edges on square and both offset-hex parities.');
// Terrain backing resolution follows display density without unbounded allocations.
for (const hex of [false,true]) {
  const near=ctx.terrainV2Resolution(12,10,hex,0,70);
  const zoomed=ctx.terrainV2Resolution(12,10,hex,0,220);
  assert(zoomed.radius>near.radius,'zoom must retain additional terrain pixels');
  const large=ctx.terrainV2Resolution(50,50,hex,0,1000);
  const w=Math.ceil(large.widthUnits*large.radius),h=Math.ceil(large.heightUnits*large.radius);
  assert(w<=4096&&h<=4096,'canvas dimension cap');
  assert(w*h<=8010000,'backing memory cap including rounding');
  assert.equal(ctx.terrainV2Resolution(12,10,hex,0,150).radius,ctx.terrainV2Resolution(12,10,hex,0,160).radius,'nearby zoom values share a cache tier');
}
console.log('Terrain resolution scales with zoom and bounds large-map memory.');
// Rendering joins all tiles before painting parapets: no rail cuts across a
// shared edge or junction, and the same masonry texture covers every path.
let curves=0,clips=0;const strokes=[];
vm.runInContext('TERRAIN_V2.images.BRIDGE=[null]',ctx);
const painter={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},rect(){},clip(){clips++;},quadraticCurveTo(){curves++;},stroke(){strokes.push(this.lineWidth);}};
const renderMap=Array(25).fill('WATER');for(const id of [6,7,8,12,17])renderMap[id]='BRIDGE';
const renderTiles=ctx.terrainV2BridgeTiles(5,5,true,renderMap);
ctx.drawTerrainV2BridgeDecks(painter,5,5,true,renderMap,0,70);
assert.equal(clips,1,'whole bridge network has one union clip');
assert.equal(curves,renderTiles.reduce((n,t)=>n+t.paths.length,0),'render every connected path');
assert.equal(strokes.length,4,'all parapets and decking render in network-wide passes');
assert(strokes.every((w,i)=>i===0||w<strokes[i-1]),'deck fills inside both continuous parapets');
