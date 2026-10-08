const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const els={},handlers={},requests=[],events=[];let fail=true;
const el=id=>els[id]??={hidden:false,textContent:'',classList:{remove(){}},onclick:null};
const c={console:{warn(){}},window:{addEventListener(){},warbornReady:false},document:{getElementById:el,body:el('body'),addEventListener:(name,fn)=>handlers[name]=fn,dispatchEvent:e=>events.push(e.type)},Event:class{constructor(type){this.type=type;}},setTimeout:()=>1,clearTimeout(){},SoundManager:{prepareMusic:async()=>{}},Image:class{
 set src(url){requests.push(url);queueMicrotask(()=>{if(fail&&url.includes('warfare-background'))this.onerror();else this.onload();});}
 async decode(){}
}};
vm.createContext(c);
const assets=fs.readFileSync('js/ui/popups-and-assets.js','utf8');
for(const name of ['DEFAULT_IMAGE_MAP','SETTLEMENT_IMAGE_MAP','FACTION_FLAG_MAP','INDICATOR_IMAGE_MAP']){
 const pattern=new RegExp('const '+name+' = ([\\s\\S]*?);');vm.runInContext(assets.match(pattern)[0],c);
}
vm.runInContext("const TERRAIN_V2_TYPES=['GRASS','WOODS','MOUNTAIN','SWAMP','DESERT','WATER','FOUNTAIN','BRIDGE','FARM'];",c);
vm.runInContext(fs.readFileSync('js/systems/leaders.js','utf8'),c);
vm.runInContext(fs.readFileSync('js/boot/startup-assets.js','utf8'),c);
(async()=>{
 const paths=vm.runInContext('StartupAssets.images()',c);
 for(const p of paths)assert(fs.existsSync(p.split('?')[0]),'Missing '+p);
 const css=fs.readFileSync('styles.css','utf8');for(const m of css.matchAll(/url\(["']?(assets\/[^)"']+)/g))assert(paths.includes(m[1]),'CSS asset not preloaded: '+m[1]);
 vm.runInContext('StartupAssets.setupComplete()',c);await vm.runInContext('StartupAssets.start()',c);
 assert.equal(c.window.warbornReady,false);assert.equal(el('startupRetry').hidden,false);assert.match(el('startupStatus').textContent,/1 asset could not load/);
 const count=requests.length;fail=false;await el('startupRetry').onclick?.();
 // DOMContentLoaded wires buttons in the browser; invoke start directly here.
 await vm.runInContext('StartupAssets.start()',c);
 assert.equal(requests.length,count+1,'Only the failed asset is retried');assert.equal(c.window.warbornReady,true);assert.equal(el('startupLoading').hidden,true);
 assert.deepEqual(events,['warborn:ready']);vm.runInContext('StartupAssets.setupComplete()',c);assert.equal(events.length,1);
 assert.equal(el('startupProgress').value,paths.length+1);
 console.log(`${paths.length} existing image URLs (including all CSS backgrounds) preload; failure/retry and one-time ready gate pass.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
