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
vm.runInContext('resources.PLAYER={gold:5,materials:0}',c);c.openSpawnMenu(0,0,{type:'CITY',owner:'PLAYER'});
body.querySelectorAll('button').find(e=>e.textContent.includes('Research')).click();const content=c.document.getElementById('tabContent');assert.equal(content.querySelectorAll('button').length,2);
content.querySelectorAll('button').find(e=>e.textContent==='Research (4G)').click();assert.equal(c.getResources('PLAYER').gold,1);assert(c.hasResearched('PLAYER','Archer'));assert.equal(content.querySelectorAll('button').length,1,'old research rows are replaced, not appended');assert(content.querySelectorAll('button')[0].disabled,'remaining research affordability updates');assert(content.children[0].textContent.includes('Archer researched'));assert.equal(c.refreshes,1);assert(c.published);
body.querySelectorAll('button').find(e=>e.textContent.includes('Build')).click();assert(content.children.some(e=>e.children.some(i=>i.innerHTML.includes('Archer'))),'researched Archer is available to build');
console.log('Research click replaces stale buttons, confirms unlock, refreshes affordability/resources, publishes state and exposes the unit in Build.');
