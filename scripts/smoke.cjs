const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const packaged=process.argv.includes('--packaged');
const paths=process.platform==='darwin'?['dist/mac-arm64/Warborn.app/Contents/MacOS/Warborn','dist/mac/Warborn.app/Contents/MacOS/Warborn']:process.platform==='win32'?['dist/win-unpacked/Warborn.exe']:['dist/linux-unpacked/warborn','dist/linux-arm64-unpacked/warborn'];
const binary=packaged?paths.find(p=>fs.existsSync(p)):require('electron');
if(!binary)throw Error('Packaged executable not found.');
const args=packaged?['--smoke-test']:['.','--smoke-test'];
// Only ephemeral Linux CI uses this flag; shipped launchers retain the sandbox.
if(process.env.CI&&process.platform==='linux')args.push('--no-sandbox');
const result=spawnSync(path.resolve(binary),args,{stdio:'inherit',timeout:75000});
if(result.error)console.error(result.error);
process.exit(result.status===0?0:1);
