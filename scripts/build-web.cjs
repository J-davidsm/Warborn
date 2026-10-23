// Export only assets used by the current renderer, using its own preload catalog.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');process.chdir(root);
const output=path.join(root,'dist/web');
const context=vm.createContext({document:{addEventListener(){}},window:{addEventListener(){}}});
const source=fs.readFileSync('js/ui/popups-and-assets.js','utf8');
for(const name of ['DEFAULT_IMAGE_MAP','SETTLEMENT_IMAGE_MAP','FACTION_FLAG_MAP','INDICATOR_IMAGE_MAP'])
 vm.runInContext(source.match(new RegExp('const '+name+' = ([\\s\\S]*?);'))[0],context);
const terrain=fs.readFileSync('js/rendering/terrain-blend.js','utf8');
for(const name of ['TERRAIN_V2_BRIDGE_IMAGE','TERRAIN_V2_BRIDGE_HUB_IMAGE','TERRAIN_V2_TYPES'])
 vm.runInContext(terrain.match(new RegExp('const '+name+' = ([\\s\\S]*?);'))[0],context);
vm.runInContext(fs.readFileSync('js/systems/leaders.js','utf8'),context);
vm.runInContext(fs.readFileSync('js/boot/startup-assets.js','utf8'),context);
const files=new Set(['index.html','styles.css',...vm.runInContext('StartupAssets.images()',context).map(p=>p.split('?')[0])]);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
for(const file of [...walk('js'),...walk('vendor')])files.add(file);
for(const m of fs.readFileSync('js/audio/soundManager.js','utf8').matchAll(/['"](assets\/[^'"\s]+)['"]/g))files.add(m[1]);
for(const m of fs.readFileSync('styles.css','utf8').matchAll(/url\(["']?(assets\/[^)"']+)/g))files.add(m[1].split('?')[0]);
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
let bytes=0;
for(const file of [...files].sort()){
 if(!fs.existsSync(file))throw Error('Missing release dependency: '+file);
 const dest=path.join(output,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);bytes+=fs.statSync(file).size;
}
fs.writeFileSync('dist/web-manifest.json',JSON.stringify({files:[...files].sort(),count:files.size,bytes},null,2));
console.log(`Web export: ${files.size} files, ${(bytes/1e6).toFixed(2)} MB, ${output}`);
