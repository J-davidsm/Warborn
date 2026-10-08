const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const original=new Uint8ClampedArray([130,128,125,255,90,70,42,255,18,120,45,255,5,10,5,0]);
let output;const canvas={getContext:()=>({drawImage(){},getImageData:()=>({data:original.slice()}),putImageData(d){output=d.data;}})};
const ctx={document:{createElement:()=>canvas},IMAGES:{Catapult:{width:4,height:1,src:'catapult'},Stockade:{width:4,height:1,src:'stockade'},Castle:{width:4,height:1,src:'castle'},'Heavy Fortress':{width:4,height:1,src:'heavy'},Dragon:{width:4,height:1}},getTeamColor:t=>({fill:t}),isFortressUnit:u=>['Stockade','Castle','Heavy Fortress','Fortress'].includes(u.name)};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/rendering/unit-presentation.js','utf8')+';this.presentation=UnitPresentation',ctx);
for(const name of ['Castle','Heavy Fortress','Fortress','Catapult','Stockade']){
 const flags=new Set();for(const team of [[40,120,230],[230,50,50],[240,205,40],[160,60,220],[45,180,70]]){
 ctx.presentation.sprite({name,team});assert.deepEqual(output.slice(0,8),original.slice(0,8),'stone and wood must not be tinted');assert.equal(output[15],0);flags.add(Array.from(output.slice(8,11)).join(','));
 }assert.equal(flags.size,5,'cloth takes all five nation colors');
}
assert.equal(ctx.presentation.sprite({name:'Dragon'}),ctx.IMAGES.Dragon);
console.log('Fortress stone/wood preserved, cloth recolored for five sides, transparent pixels and neutral elite art preserved.');
