const assert=require('node:assert/strict'),{assetFor}=require('../scripts/install.cjs'),p=require('../package.json'),fs=require('node:fs');
for(const arch of ['x64','arm64']){
 assert.equal(assetFor('darwin',arch),`Warborn-mac-${arch}.zip`);
 assert.equal(assetFor('linux',arch),`Warborn-linux-${arch}.deb`);
 assert.equal(assetFor('win32',arch),'Warborn-win-x64.exe');
}
assert.throws(()=>assetFor('linux','ia32'));assert.throws(()=>assetFor('freebsd','x64'));
assert.equal(p.build.appId,'com.warborn.game');assert.equal(p.build.nsis.deleteAppDataOnUninstall,false);
assert(fs.existsSync(p.main));assert(fs.existsSync(p.build.mac.icon));
const source=fs.readFileSync(p.main,'utf8');assert(!source.includes('/Applications/'));assert(!source.includes('disable-features'));assert(!source.includes('no-sandbox'));
console.log('Installer platform mapping, save-preserving identity, packaging paths and production sandbox verified.');
