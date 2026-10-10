const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function scenario(aiTurn){
 const nodes=new Map();
 function element(id,parent){const el={id,parentElement:parent,contains(child){for(let n=child;n;n=n.parentElement)if(n===this)return true;return false;},append(child){child.parentElement=this;},remove(){for(const [key,node]of nodes)if(this.contains(node))nodes.delete(key);}};nodes.set(id,el);return el;}
 const body=element('body',null),modal=element('diplomacyModal',body),ribbon=element('turnRibbon',aiTurn?modal:body);element('battleAlerts',body);
 const c={console,document:{body,getElementById:id=>nodes.get(id)||null},diplomacy:{aiMessages:[{message:'Old battle'}],treaties:[{}]}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/systems/diplomacy.js','utf8'),c);
 c.resetDiplomacySession();
 assert.equal(nodes.get('turnRibbon'),ribbon,'replaying must preserve the shared HUD ribbon after either side’s turn');
 assert.equal(ribbon.parentElement,body);assert(!nodes.has('diplomacyModal'));assert(!nodes.has('battleAlerts'));
 assert.equal(c.diplomacy.aiMessages.length,0);assert.equal(c.diplomacy.treaties.length,0);
 c.resetDiplomacySession();assert.equal(nodes.get('turnRibbon'),ribbon,'repeated replay remains safe');
 nodes.delete('turnRibbon');assert.doesNotThrow(()=>c.resetDiplomacySession(),'startup without a HUD remains supported');
}
scenario(true);scenario(false);
console.log('Replay preserves the HUD after AI/player turns while clearing old diplomacy.');
