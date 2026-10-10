const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const packaged=process.argv.includes('--packaged');
const paths=process.platform==='darwin'?['dist/mac-arm64/Acadania.app/Contents/MacOS/Acadania','dist/mac/Acadania.app/Contents/MacOS/Acadania']:process.platform==='win32'?['dist/win-unpacked/Acadania.exe']:['dist/linux-unpacked/acadania','dist/linux-arm64-unpacked/acadania'];
const binary=packaged?paths.find(p=>fs.existsSync(p)):require('electron');
if(!binary)throw Error('Packaged executable not found.');
const args=packaged?['--smoke-test']:['.','--smoke-test'];
// Only ephemeral Linux CI uses this flag; shipped launchers retain the sandbox.
if(process.env.CI&&process.platform==='linux')args.push('--no-sandbox');
const result=spawnSync(path.resolve(binary),args,{stdio:'inherit',timeout:75000});
if(result.error)console.error(result.error);
process.exit(result.status===0?0:1);
