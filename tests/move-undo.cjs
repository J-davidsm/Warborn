const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let posted=0;
const c={units:[],settlements:[],resources:{PLAYER:{gold:0,materials:0}},terrain:[],turnNumber:1,currentTeam:'PLAYER',researchedUnits:{PLAYER:new Set(['Soldier'])},diplomacy:{aiMessages:[],unreadMessages:0},gameOver:false,isEditorMode:false,ActionEffects:{move(){}},closeSpawnMenu(){},updateUI(){},postGameState(){posted++;}};
vm.createContext(c);vm.runInContext(fs.readFileSync('js/systems/move-undo.js','utf8'),c);const undo=vm.runInContext('MoveUndo',c);
function move(owner){c.units=[{id:'a',col:0,row:0,team:'PLAYER',hp:50,hasMoved:false,hasActed:false}];c.settlements=[null,{type:'VILLAGE',owner}];c.diplomacy={aiMessages:[],unreadMessages:0};undo.begin(c.units[0]);c.units[0].col=1;c.units[0].hasMoved=true;c.settlements[1].owner='PLAYER';c.diplomacy.aiMessages.push({from:'AI',message:'Captured',timestamp:5,read:false});undo.finish();}
for(const owner of [null,'AI']){move(owner);assert(undo.canUndo());assert(undo.undo());assert.equal(c.units[0].col,0);assert.equal(c.units[0].hasMoved,false);assert.equal(c.settlements[1].owner,owner);assert.equal(c.diplomacy.aiMessages.length,0);assert(!undo.canUndo());}
move('AI');c.units[0].hasActed=true;assert(!undo.undo(),'attack consumes undo');
move('AI');c.resources.PLAYER.gold=10;assert(!undo.undo(),'purchases/income consume undo');c.resources.PLAYER.gold=0;
move(null);c.currentTeam='AI';assert(!undo.undo(),'not during opponent turn');c.currentTeam='PLAYER';c.turnNumber++;assert(!undo.undo(),'not in later turn');
move('AI');c.units=JSON.parse(JSON.stringify(c.units));c.settlements=JSON.parse(JSON.stringify(c.settlements));c.diplomacy=JSON.parse(JSON.stringify(c.diplomacy));c.OnlineMatch={canAct:()=>false};assert(!undo.undo(),'pending multiplayer action blocks undo');c.OnlineMatch.canAct=()=>true;assert(undo.undo(),'accepted multiplayer snapshot supports undo');assert.equal(c.settlements[1].owner,'AI');assert.equal(c.diplomacy.aiMessages.length,0);assert.equal(posted,3);
console.log('Move undo restores movement and captured settlements, syncs state, and rejects later actions and turns.');
