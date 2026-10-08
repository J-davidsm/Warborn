const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {client,tick}=require('./multiplayer-harness.cjs');
const source=fs.readFileSync('js/net/public-lobby.js','utf8');
const app=client('Desktop'),web=client('Website'),preview=client('Developer');
for(const [p,url] of [[app,'file:///Applications/Warborn.app/Contents/Resources/app.asar/app/index.html'],[web,'https://j-davidsm.github.io/Warborn/'],[preview,'http://localhost:8767/']]){
 p.ctx.location.href=url;vm.runInContext(source,p.ctx);p.handlers.DOMContentLoaded();tick();
}
for(const p of [app,web])assert.equal(p.el('publicPlayers').children.length,2,'desktop and website share a directory');
assert.equal(preview.el('publicPlayers').children.length,1,'development stays separate');
app.el('menuOnlineBtn').onclick();tick();
const visitor=app.el('publicPlayers').children.find(r=>r.children[0].textContent.startsWith('Website'));
visitor.children[1].onclick();tick();
assert.equal(web.el('publicInvite').hidden,false,'desktop invitation reaches website');
web.el('publicInvite').children[1].onclick();tick();
assert.equal(app.el('lobbyPlayers').children.length,2);
app.el('lobbyReady').onclick();web.el('lobbyReady').onclick();tick();
app.el('lobbyStart').onclick();tick();assert(web.run('OnlineMatch.playing'));
assert.equal(JSON.stringify(app.ctx.units),JSON.stringify(web.ctx.units));
const actor=app.ctx.currentTeam==='PLAYER'?app:web,observer=actor===app?web:app;
actor.ctx.units[0].hp=43;actor.run('OnlineMatch.publish()');tick();assert.equal(observer.ctx.units[0].hp,43,'mixed clients synchronize gameplay');
(async()=>{
 let link;app.ctx.navigator.clipboard={writeText:async value=>{link=value;}};
 await app.el('lobbyCopy').onclick();
 assert.equal(new URL(link).origin,'https://j-davidsm.github.io');
 assert.equal(new URL(link).pathname,'/Warborn/');
 assert.equal(new URL(link).searchParams.get('room'),app.el('lobbyRoom').textContent);
 console.log('Desktop/web discovery, invitation, room join, start, state sync, public invite URL and preview isolation pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});
