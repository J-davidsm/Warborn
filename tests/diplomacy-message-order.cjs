const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const pane={innerHTML:'',scrollTop:0,scrollHeight:500};
const c={console,Date:{now:()=>1000},turnNumber:2,currentDiplomacyTarget:'AI',
 messageHistory:{AI:[{from:'PLAYER',message:'Legacy greeting',turn:2}]},
 diplomacy:{aiMessages:[],unreadMessages:0},document:{getElementById:id=>id==='messageHistory'?pane:null},
 getTeamColorHex:()=> '#fff'};
vm.createContext(c);vm.runInContext(fs.readFileSync('js/systems/diplomacy.js','utf8'),c);
vm.runInContext('currentDiplomacyTarget="AI"; messageHistory=globalThis.messageHistory;',c);
c.updateNotificationBubble=()=>{};c.updateDiplomacyButtonBubbles=()=>{};
c.messageHistory.AI.push({from:'PLAYER',message:'New greeting',turn:2,timestamp:c.nextDiplomacyMessageTimestamp()});
c.addAIMessage('AI','Battle loss','UNIT_KILLED');
c.messageHistory.AI.push({from:'AI',message:'Treaty response',turn:2,timestamp:c.nextDiplomacyMessageTimestamp()});
c.addAIMessage('AI','Town taken','SETTLEMENT_CAPTURED');
c.addAIMessage('AI2','Other faction','GENERAL');
c.loadMessageHistory();
const expected=['Legacy greeting','New greeting','Battle loss','Treaty response','Town taken'];
for(let i=1;i<expected.length;i++)assert(pane.innerHTML.indexOf(expected[i])>pane.innerHTML.indexOf(expected[i-1]));
assert(!pane.innerHTML.includes('Other faction'));assert.equal(pane.scrollTop,500);
const original=pane.innerHTML;c.Date.now=()=>900000;c.loadMessageHistory();assert.equal(pane.innerHTML,original);
console.log('Mixed conversation and battle notices remain chronological, faction-specific, and scrolled to the bottom.');
