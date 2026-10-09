const fs=require('node:fs'),{spawnSync}=require('node:child_process');
for(const file of fs.readdirSync('tests').filter(f=>f.endsWith('.cjs')&&f!=='multiplayer-harness.cjs')){
 const result=spawnSync(process.execPath,['tests/'+file],{encoding:'utf8'});
 if(result.status!==0){console.error(file,result.stdout,result.stderr);process.exit(1);}
 console.log('PASS',file);
}
