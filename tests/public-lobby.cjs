const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {client,tick,peers,registry}=require('./multiplayer-harness.cjs');
const source=fs.readFileSync('js/net/public-lobby.js','utf8');
const a=client('Alice'),b=client('Bob'),c=client('Carol');
for(const p of [a,b,c]){vm.runInContext(source,p.ctx);p.handlers.DOMContentLoaded();tick();}
for(const p of [a,b,c])assert.equal(p.el('publicPlayers').children.length,3,'all website visitors are listed');
a.el('lobbyCapacity').value='3';a.el('menuOnlineBtn').onclick();tick();
const bob=a.el('publicPlayers').children.find(row=>row.children[0].textContent.startsWith('Bob'));
bob.children[1].onclick();tick();assert.equal(b.el('publicInvite').hidden,false,'invitation reaches selected visitor');
b.el('publicInvite').children[1].onclick();tick();assert.equal(a.el('lobbyPlayers').children.length,2,'invitation joins without a code');
const room=c.el('publicPlayers').children.find(row=>row.children[0].textContent.startsWith('Alice'));
assert.equal(room.children[1].textContent,'Join');room.children[1].onclick();tick();assert.equal(a.el('lobbyPlayers').children.length,3);
// A closed directory leader disappears, and a surviving visitor can take over.
const root=[...registry.keys()].find(id=>id.startsWith('warborn-j-davidsm-public'));
registry.get(root).destroy();tick();
const retry=b.timers.find(t=>t.delay>=1200&&t.delay<=3200);assert(retry);retry.fn();tick();
const retryC=c.timers.find(t=>t.delay>=1200&&t.delay<=3200);assert(retryC);retryC.fn();tick();
assert.equal(b.el('publicPlayers').children.length,2,'directory recovers with surviving visitors');
assert.equal(c.el('publicPlayers').children.length,2);
console.log('Public presence, invitations, code-free room joins, leave removal and directory takeover pass.');
