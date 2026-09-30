const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element {
 constructor(tag){this.tag=tag;this.style={};this.children=[];this.events={};this.textContent='';}
 set innerHTML(value){this.html=value;this.children=[];}get innerHTML(){return this.html||'';}
 appendChild(e){e.parent=this;this.children.push(e);}prepend(e){e.parent=this;this.children.unshift(e);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);}
 setAttribute(k,v){this[k]=v;}addEventListener(k,f){this.events[k]=f;}querySelectorAll(tag){return this.children.flatMap(e=>[...(e.tag===tag?[e]:[]),...e.querySelectorAll(tag)]);}click(){(this.events.click||this.onclick)?.({stopPropagation(){}});}
}
const body=new Element('body');const c={console,document:{body,createElement:t=>new Element(t),getElementById:id=>body.querySelectorAll('div').find(e=>e.id===id)},updateUI(){c.refreshes++;},refreshes:0,postGameState(){c.published=true;},isAITeam:()=>false};vm.createContext(c);
for(const file of ['js/systems/economy-research.js','js/data/units-and-build.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
c.createUnitIcon=()=>new Element('img');c.allowedUnitsForSettlement=()=>['Soldier','Archer','Spearman'];
vm.runInContext('resources.PLAYER={gold:9,materials:0};restoreResearchPoints({PLAYER:4})',c);c.openSpawnMenu(0,0,{type:'CITY',owner:'PLAYER'});
body.querySelectorAll('button').find(e=>e.textContent.includes('Research')).click();const content=c.document.getElementById('tabContent');assert.equal(content.querySelectorAll('button').length,60);
const card=id=>content.querySelectorAll('article').find(e=>e['data-tech-id']===id);
assert(card('archery').children[1].disabled);
card('steel_arms').children[1].click();assert.equal(c.getResources('PLAYER').gold,9);assert.equal(c.getResearchPoints('PLAYER'),2);assert(!card('archery').children[1].disabled);
card('archery').children[1].click();assert.equal(c.getResources('PLAYER').gold,9);assert.equal(c.getResearchPoints('PLAYER'),0);assert(c.isUnitUnlocked('PLAYER','Archer'));
assert.equal(content.querySelectorAll('button').length,60,'cards persist without duplicates');
assert.equal(card('archery').children[1].textContent,'Researched');assert(card('archery').children[1].disabled);
assert.equal(card('field_training').children[1].textContent,'Need 2 more RP');assert(card('field_training').children[1].disabled);
assert(card('field_training').children[0].innerHTML.includes('2 RP'));
assert(content.children[0].textContent.includes('Archery researched'));assert.equal(c.refreshes,2);Promise.resolve().then(()=>assert(c.published));
assert.equal(content.querySelectorAll('section').length,4);assert(card('dragon_corps').children[0].innerHTML.includes('Artillery and Mass Production'));
body.querySelectorAll('button').find(e=>e.textContent.includes('Build')).click();assert(content.children.some(e=>e.children.some(i=>i.innerHTML.includes('Archer'))));
console.log('Doctrine UI shows all four branches, all 28 nodes, AND prerequisites, locked/available/researched states and refreshed purchases.');
