const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console,document:{addEventListener(){}},localStorage:{getItem:()=>JSON.stringify({mapSize:{cols:4,rows:4},name:'Checkpoint'})},getSavedLevels:()=>[{name:'My level',data:{mapSize:{cols:5,rows:5}}}]};
vm.createContext(c);
for(const file of ['js/data/example-scenarios.js','js/ui/solo-menu.js','js/ui/editor-studio.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
const run=code=>vm.runInContext(code,c);
const blank=run('SoloMenu.emptyScenario()');assert.equal(blank.terrain.length,16);assert(blank.terrain.every(t=>t==='GRASS'));assert.equal(blank.units.length,0);assert(blank.settlements.every(t=>t===null));assert.equal(blank.aiPlayerCount,1);
blank.terrain[0]='WATER';assert.equal(run('SoloMenu.emptyScenario().terrain[0]'),'GRASS','new maps never share arrays');
const library=run('SoloMenu.entries()');assert.deepEqual(Array.from(library,e=>e.name),['Checkpoint','My level',"Harper's Ferry",'Homogenous System']);assert(library.slice(2).every(e=>e.example));
for(const entry of library.slice(2)){
 const d=entry.data;assert.equal(d.terrain.length,d.mapSize.cols*d.mapSize.rows);assert.equal(d.settlements.length,d.terrain.length);assert(d.units.length>0);assert(d.units.every(u=>u.col>=0&&u.col<d.mapSize.cols&&u.row>=0&&u.row<d.mapSize.rows));assert(!d.diplomacy.conversations);assert(!d.diplomacy.aiMessages);
}
assert.equal(library[2].data.units.length,39);assert.equal(library[3].data.units.length,59);
const lessons=run('EditorStudio.lessons');for(const id of ['aiPlayerControls','mapSizeContent','terrainContent','editorSidePicker','unitsContent','startingDiplomacyEditor','editorSaveControls'])assert(lessons.some(step=>step[0]===id));
// Changing sides updates the active unit brush as well as the hidden compatibility select.
c.getActiveTeams=()=>['PLAYER','AI'];c.isEditorMode=false;c.selectedTeam='PLAYER';c.placingUnitType='Knight';c.placingUnitTeam='PLAYER';c.Event=class{};const select={value:'PLAYER',dispatchEvent(){}};c.document.getElementById=id=>id==='teamSelect'?select:null;
run("EditorStudio.chooseSide('AI')");assert.equal(c.placingUnitTeam,'AI');assert.equal(c.selectedTeam,'AI');assert.equal(select.value,'AI');run("EditorStudio.chooseSide('AI4')");assert.equal(c.selectedTeam,'AI','inactive kingdoms cannot be selected');
console.log('Blank maps, named and quick saves, both exact example armies, editor lesson coverage and side switching pass.');
