/* Run from a reviewed checkout: node scripts/install.cjs.
   Downloads a release, verifies its SHA-256, then runs the OS installer. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
function assetFor(platform,arch){
 if(!['x64','arm64'].includes(arch))throw Error('Warborn desktop supports 64-bit Intel/AMD and ARM computers only.');
 if(platform==='darwin')return `Warborn-mac-${arch}.zip`;
 if(platform==='linux')return `Warborn-linux-${arch}.deb`;
 if(platform==='win32')return 'Warborn-win-x64.exe'; // Windows on ARM can run the x64 build.
 throw Error('Supported systems: macOS, Windows and Ubuntu/Debian.');
}
function run(command,args){const r=spawnSync(command,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)throw Error(`${command} failed (${r.status}).`);}
async function main(){
 if(typeof fetch!=='function')throw Error('Install Node.js 22 LTS or newer first.');
 const name=assetFor(process.platform,process.arch);
 if(process.platform==='linux'&&!fs.existsSync('/etc/debian_version'))throw Error('This installer supports Ubuntu/Debian Linux. Other distributions can use the website or build from source.');
 const headers={'User-Agent':'Warborn-installer','Accept':'application/vnd.github+json'};
 const response=await fetch('https://api.github.com/repos/J-davidsm/Warborn/releases/latest',{headers});
 if(!response.ok)throw Error(`Release lookup failed (${response.status}). See https://github.com/J-davidsm/Warborn/releases`);
 const release=await response.json();
 const asset=release.assets.find(a=>a.name===name),sums=release.assets.find(a=>a.name==='SHA256SUMS');
 if(!asset||!sums)throw Error(`Latest release has no verified ${name} package.`);
 async function download(url){const r=await fetch(url);if(!r.ok)throw Error(`Download failed (${r.status})`);return Buffer.from(await r.arrayBuffer());}
 console.log(`Downloading ${release.tag_name}: ${name}`);
 const manifest=(await download(sums.browser_download_url)).toString();
 const expected=manifest.split(/\r?\n/).map(l=>l.trim().split(/\s+/)).find(parts=>parts[1]===name)?.[0];
 if(!/^[a-f0-9]{64}$/.test(expected||''))throw Error('Package checksum missing.');
 const bytes=await download(asset.browser_download_url);
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Checksum mismatch; refusing installation.');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'warborn-install-')),file=path.join(dir,name);fs.writeFileSync(file,bytes);
 console.log('Checksum verified. Close Warborn before replacing an existing installation.');
 if(process.platform==='win32')run(file,[]);
 else if(process.platform==='linux')run('sudo',['apt-get','install','-y',file]);
 else{
  const existing='/Applications/Warborn.app';
  const destination=fs.existsSync(existing)?existing:path.join(os.homedir(),'Applications','Warborn.app');
  const running=spawnSync('pgrep',['-f',destination+'/Contents/MacOS/Warborn']);
  if(running.status===0)throw Error('Quit Warborn and rerun this command.');
  const unpack=path.join(dir,'unpacked');run('ditto',['-x','-k',file,unpack]);
  const source=path.join(unpack,'Warborn.app');
  if(!fs.existsSync(path.join(source,'Contents','MacOS','Warborn')))throw Error('Invalid Mac package.');
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  // Copy to a sibling before replacing, so downloads never damage the old app.
  const staged=destination+'.installing';if(fs.existsSync(staged))throw Error(`Remove the incomplete staging folder first: ${staged}`);
  run('ditto',[source,staged]);run('codesign',['--verify','--deep','--strict',staged]);
  fs.rmSync(destination,{recursive:true,force:true});fs.renameSync(staged,destination);
  console.log(`Installed ${destination}`);
 }
 fs.rmSync(dir,{recursive:true,force:true});console.log('Warborn installed. Saved games were not removed.');
}
module.exports={assetFor};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
