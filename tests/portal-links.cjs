const assert=require('node:assert/strict'),{inviteURL}=require('../js/net/portal-links.js');
for(const href of ['https://cdn.example/123/index.html?tracking=1','file:///Applications/Acadania.app/index.html']){
 const url=new URL(inviteURL('ABCD2345',href,true));assert.equal(url.origin,'https://j-davidsm.github.io');assert.equal(url.search,'?room=ABCD2345');
}
assert.equal(inviteURL('ABCD2345','https://game.example/path/?old=1#menu',false),'https://game.example/path/?room=ABCD2345');
assert.equal(inviteURL('ABCD2345','file:///game/index.html',false),'https://j-davidsm.github.io/Warborn/?room=ABCD2345');
console.log('Portal, desktop and standalone invite URLs pass.');
