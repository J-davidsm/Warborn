const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const c={console,Math,Date,campaignMode:{campaignData:{scenarios:[]}},aiTeamNames:['AI','AI2','AI3','AI4'],isAITeam:t=>t.startsWith('AI'),normalizeVictoryCondition:x=>x,getVictoryConditionLabel:()=>'',units:[]};vm.createContext(c);vm.runInContext(fs.readFileSync('js/systems/campaign.js','utf8'),c);
for(const difficulty of ['easy','standard','hard','brutal'])for(const aiCount of [1,2,4])for(const size of [8,16,50])for(let n=0;n<4;n++){
 const s=c.generateScenario({difficulty,aiCount,cols:size,rows:size});const used=new Set();
 for(const u of [...Object.values(s.startingUnits).flat(),...s.settlements]){const k=u.row*size+u.col;assert(!used.has(k),'overlap '+difficulty+' '+size);used.add(k);assert(u.col>=0&&u.row>=0&&u.col<size&&u.row<size);}
 assert(s.settlements.every(x=>x.owner&&s.startingUnits[x.owner]),'all settlements belong to a faction');
 if(['hard','brutal'].includes(difficulty)){
  const cities=t=>s.settlements.filter(x=>x.owner===t&&x.type==='CITY').length;
  for(const t of Object.keys(s.startingUnits).filter(t=>t!=='PLAYER'))assert.equal(cities(t)/cities('PLAYER'),difficulty==='hard'?1.5:3);
  assert(s.balanceScore >= (difficulty==='hard'?.95:1.1)&&s.balanceScore <= (difficulty==='hard'?1.1:1.35),s.balanceScore);
 }
}
console.log('Generated ownership, army balance, production ratios and nonoverlapping starts pass across difficulties, 1–4 AIs and 8–50 tile maps.');
