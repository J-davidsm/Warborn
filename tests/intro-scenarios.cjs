const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={console,document:{addEventListener(){},getElementById:()=>null},localStorage:{getItem:()=>null}};
vm.createContext(c);
vm.runInContext(fs.readFileSync('js/core/intro-scenarios.js','utf8'),c);
vm.runInContext(fs.readFileSync('js/ui/battle-guide.js','utf8'),c);
for(const training of [false,true]){
 const d=c.createIntroScenario(training);
 assert.equal(d.mapSize.cols*d.mapSize.rows,d.terrain.length);
 assert(d.units.filter(u=>u.team==='PLAYER').length>=6);
 assert(d.units.filter(u=>u.team==='AI').length>=2);
 assert.equal(new Set(d.units.map(u=>`${u.col},${u.row}`)).size,d.units.length);
 for(const u of d.units){assert(u.col>=0&&u.col<12&&u.row>=0&&u.row<10);assert(!['WATER','SWAMP','MOUNTAIN'].includes(d.terrain[u.row*12+u.col]));}
 for(const r of Object.values(d.startingResources))assert.equal(r.gold+r.materials,0);
 const v=d.victoryCondition;assert.equal(d.settlements[v.holdRow*12+v.holdCol].owner,'AI');
 assert(d.settlements.some(s=>s?.owner==='PLAYER'));assert(d.terrain.includes('BRIDGE'));
 if(training){
  c.currentVictoryCondition=v;
  const lessons=vm.runInContext('BattleGuide.lessons()',c);
  assert(lessons.length>=20);
  for(const [title,text,p] of lessons){assert(text.length>40);assert(p&&p.col>=0&&p.col<12&&p.row>=0&&p.row<10,title);}
  const expected={'Our objective':'VILLAGE','Open your town':'VILLAGE','Income and recruitment':'HAMLET','Take a new foothold':'HAMLET'};
  for(const [title,type] of Object.entries(expected)){const p=lessons.find(l=>l[0]===title)[2];assert.equal(d.settlements[p.row*12+p.col]?.type,type);}
  for(const [title,type] of [['Forest cover','WOODS'],['Marsh slows the fight','SWAMP'],['Water and bridges','WATER'],['The crossing','BRIDGE'],['Healing spring','FOUNTAIN']]){const p=lessons.find(l=>l[0]===title)[2];assert.equal(d.terrain[p.row*12+p.col],type);}
 }
}
console.log('Intro armies, zero economy, valid objectives and tutorial highlights pass.');
