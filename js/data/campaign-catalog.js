// Authored mission specifications; seeded geography makes retries reproducible.
const CAMPAIGN_CHAPTERS = [
  {id:'dawn', name:'The Rising Banner', difficulty:'Easy', subtitle:'Learn to lead across the borderlands.', missions:[
    ['Greenbank', 'meadow', 1, 'CAPTURE_TOWN', false, false, 'Greenbank', 'Retake the river market. Your larger army gives you room to learn.'],
    ['The Lightwood Crown', 'forest', 1, 'KILL_CROWN', false, false, '', 'Hunt the red Crown through sunlit woodland. Keep your own Crown behind the line.'],
    ['Reedwatch', 'marsh', 1, 'HOLD_TILE', false, false, 'Reedwatch', 'Hold the raised village for three rounds. Dry tracks wind between the marshes.'],
    ['Oath of the Isles', 'islands', 2, 'CAPTURE_TOWN', true, false, 'Tidehaven', 'The green kingdom is your ally. Cross the causeways together to seize Tidehaven.'],
    ['The Amber Road', 'desert', 1, 'ANNIHILATE_TEAM', false, false, '', 'Break the red kingdom. Rest at fountains and use the safe road through the dunes.'],
    ['Highpass Vigil', 'mountain', 2, 'SURVIVE_TURNS', true, false, '', 'Hold on until turn 12 with your green ally. The mountain passes favor a patient defense.'],
    ['Two Banners at Dusk', 'river', 2, 'KILL_CROWN', false, true, '', 'Two enemy kingdoms have joined forces. Reach the red Crown to end their invasion.']
  ]},
  {id:'tides', name:'The Fractured Kingdoms', difficulty:'Standard', subtitle:'Alliances and rival crowns contest the frontier.', missions:[
    ['The Broken Delta', 'delta', 2, 'CAPTURE_TOWN', false, false, 'Delta Gate', 'Red and green also fight each other. Take advantage of their feud to capture Delta Gate.'],
    ['A Pact in the Pines', 'forest', 2, 'ANNIHILATE_TEAM', true, false, '', 'Your green ally will aid the attack. Destroy the red kingdom and seize its holdings.'],
    ['The Glass Coast', 'coast', 2, 'KILL_CROWN', false, true, '', 'Two allied enemies hold the coast. The red Crown is the only target you must eliminate.'],
    ['Ashen Stair', 'mountain', 3, 'CAPTURE_TOWN', false, false, 'Skyreach', 'Three rivals guard the mountain country. Capture the red capital; the others need not fall.'],
    ['Mirebound Alliance', 'marsh', 3, 'HOLD_TILE', true, true, 'Lanternfen', 'Green stands with you against red and yellow. Hold Lanternfen for four rounds.'],
    ['Saffron Siege', 'desert', 3, 'ANNIHILATE_TEAM', false, true, '', 'A hostile coalition protects the red kingdom. Bring your catapult against its castle.'],
    ['Crown of the Archipelago', 'islands', 3, 'KILL_CROWN', true, true, '', 'Fight beside green across connected islands. Kill the red Crown while yellow protects it.']
  ]},
  {id:'storm', name:'War of the Last Crown', difficulty:'Hard', subtitle:'Four rival kingdoms. One throne to survive.', missions:[
    ['The Iron Divide', 'mountain', 3, 'CAPTURE_TOWN', false, true, 'Ironhold', 'An enemy coalition controls the heights. Breach Ironhold with your siege force.'],
    ['Thorns and Thrones', 'forest', 3, 'ANNIHILATE_TEAM', false, false, '', 'Three enemy kingdoms compete in the forest. Destroy red while the others battle for territory.'],
    ['Blackwater Oath', 'marsh', 4, 'HOLD_TILE', true, true, 'Blackwater', 'Green is your only ally against three joined kingdoms. Hold Blackwater for five rounds.'],
    ['The Sunken Crowns', 'islands', 4, 'KILL_CROWN', false, true, '', 'Four kingdoms share a defensive pact. Strike the red Crown beyond their island strongholds.'],
    ['Embers of the Dunes', 'desert', 4, 'SURVIVE_TURNS', true, true, '', 'Survive until turn 18. Your green ally and healing fountains are vital in this desert war.'],
    ['Stormbreak', 'coast', 4, 'ANNIHILATE_TEAM', false, false, '', 'Rival armies converge along the coast. Red alone must lose its army and every town.'],
    ['The Last Throne', 'caldera', 4, 'KILL_CROWN', false, true, '', 'The four crowns unite against you. Cross the caldera, defeat the guards, and bring down the red Crown.']
  ]}
];

// Each mission has its own deployment, economy, and force composition.
// Seat order is PLAYER, red, green, yellow, purple; extra towns are authored
// independently of the capitals. Coordinates are deliberately asymmetric.
const CAMPAIGN_BATTLE_PLANS = [
  [
    {size:[16,14], seats:[[2,10],[12,3]], army:'Soldier Soldier Spearman Archer Cleric', foes:['Soldier Archer'], towns:[[5,9,null,'HAMLET'],[10,5,'AI','VILLAGE']], focus:[10,5], approach:'river crossing', briefing:'A small infantry column must take the forward market. Capture the nearby hamlet to fund reinforcements.'},
    {size:[20,14], seats:[[3,3],[16,10]], army:'Assassin Archer Archer Spearman', foes:['Spearman Archer Soldier'], towns:[[8,4,null,'VILLAGE'],[14,7,'AI','HAMLET']], approach:'woodland hunt', briefing:'Lead a light hunting party from the northwest. Your assassin threatens the Crown; your archers need a screen.'},
    {size:[16,19], seats:[[3,15],[12,3]], army:'Swordsman Spearman Cleric Cleric Stockade', foes:['Soldier Soldier Archer'], towns:[[7,9,null,'VILLAGE'],[11,13,null,'HAMLET']], focus:[7,9], approach:'marsh defense', briefing:'Advance a slow shield wall to Reedwatch. Two clerics sustain the defenders; your starting stockade guards home.'},
    {size:[22,16], seats:[[3,12],[18,4],[4,3]], army:'Knight Spearman Archer Cleric', foes:['Soldier Spearman Archer','Soldier Archer Archer'], towns:[[10,12,null,'HAMLET'],[15,7,'AI','VILLAGE']], focus:[15,7], approach:'two-pronged alliance', briefing:'You land in the southwest while your ally advances from the northwest. Meet at the island market before the final crossing.'},
    {size:[24,12], seats:[[3,6],[20,6]], army:'Knight Knight Assassin Cleric Soldier', foes:['Spearman Spearman Archer Cleric'], towns:[[8,4,null,'VILLAGE'],[15,8,'AI','HAMLET'],[12,6,null,'HAMLET']], approach:'oasis pursuit', briefing:'A mounted expedition races along the long oasis road. Enemy spearmen punish a careless cavalry charge.'},
    {size:[15,22], seats:[[6,17],[7,3],[3,12]], army:'Archer Archer Spearman Cleric Catapult Stockade', foes:['Swordsman Knight Archer','Spearman Archer Cleric'], towns:[[10,15,'PLAYER','HAMLET'],[9,8,null,'VILLAGE']], approach:'mountain rearguard', briefing:'Hold the southern heights with archers and a catapult. Your ally occupies the middle pass, buying time for your defenses.'},
    {size:[22,18], seats:[[10,14],[4,3],[17,4]], army:'Swordsman Knight Archer Archer Cleric Catapult', foes:['Soldier Spearman Archer','Soldier Knight'], towns:[[10,10,null,'VILLAGE'],[4,7,'AI','HAMLET'],[17,8,'AI2','HAMLET']], approach:'divided enemy front', briefing:'Two armies approach from opposite riverbanks. Choose which front to contain and send your siege escort toward the red Crown.'}
  ],
  [
    {size:[24,18], seats:[[3,14],[19,4],[5,3]], army:'Spearman Spearman Archer Assassin Cleric', foes:['Knight Archer Cleric','Swordsman Archer Soldier'], towns:[[12,9,null,'CITY'],[18,9,'AI','VILLAGE'],[7,10,null,'HAMLET']], focus:[18,9], approach:'three-way delta war', briefing:'The river market lies between three rival armies. Expand through the delta or skirt the fighting to strike the red outpost.'},
    {size:[18,24], seats:[[3,4],[13,19],[13,5]], army:'Archer Archer Assassin Cleric Swordsman', foes:['Knight Spearman Archer Cleric Stockade','Knight Knight Cleric'], towns:[[5,12,null,'VILLAGE'],[11,15,'AI','HAMLET'],[13,10,'AI2','HAMLET']], approach:'forest pincer', briefing:'Your archers and assassin clear the western forest while allied cavalry advances down the east.'},
    {size:[26,14], seats:[[3,9],[22,4],[13,9]], army:'Dragon Spearman Cleric Archer', foes:['Spearman Archer Cleric Stockade','Knight Spearman Archer'], towns:[[7,5,null,'HAMLET'],[17,7,'AI2','VILLAGE']], approach:'coastal crown raid', briefing:'Your first dragon can bypass the coast road. Keep the smaller ground escort and Crown safe while the dragon opens a route.'},
    {size:[21,23], seats:[[9,19],[10,3],[3,10],[17,12]], army:'Catapult Catapult Knight Spearman Cleric Archer', foes:['Castle Swordsman Archer Cleric','Assassin Archer Spearman','Knight Soldier Archer'], towns:[[10,7,'AI','CITY'],[6,15,null,'VILLAGE'],[15,6,null,'HAMLET']], focus:[10,7], approach:'uphill siege', briefing:'Twin catapults must ascend to Skyreach. The two flank kingdoms also fight red; leave them space to disrupt the siege defenders.'},
    {size:[25,20], seats:[[3,4],[21,4],[4,15],[20,15]], army:'Swordsman Swordsman Cleric Cleric Archer Stockade', foes:['Assassin Spearman Archer','Knight Archer Cleric','Knight Spearman Archer Cleric'], towns:[[12,13,null,'CITY'],[9,5,null,'HAMLET'],[17,9,null,'HAMLET']], focus:[12,13], approach:'allied relief mission', briefing:'Your ally starts closer to Lanternfen. March southeast to reinforce them with healers before the two enemy columns arrive.'},
    {size:[28,16], seats:[[3,8],[23,8],[17,3],[17,12]], army:'Catapult Catapult Swordsman Knight Cleric Spearman', foes:['Castle Swordsman Archer Cleric','Assassin Archer Archer','Knight Spearman Cleric'], towns:[[9,8,null,'VILLAGE'],[22,4,'AI','HAMLET'],[22,12,'AI','HAMLET']], approach:'fortified desert capital', briefing:'Red has three settlements supporting its castle. Take the staging village and shield your siege engines from both flanks.'},
    {size:[24,24], seats:[[3,19],[19,3],[4,5],[19,17]], army:'Dragon Knight Cleric Assassin Spearman', foes:['Knight Archer Archer Cleric','Catapult Swordsman Cleric','Dragon Spearman Archer'], towns:[[11,12,null,'VILLAGE'],[14,5,'AI','HAMLET'],[10,19,null,'HAMLET']], approach:'island strike force', briefing:'A dragon and assassin spearhead the Crown hunt. Your allied siege army crosses from the northwestern island while yellow threatens your rear.'}
  ],
  [
    {size:[24,26], seats:[[10,21],[11,3],[3,10],[19,11]], army:'Catapult Catapult Catapult Swordsman Spearman Cleric Cleric', foes:['Heavy Fortress Knight Archer Cleric','Assassin Knight Archer','Swordsman Spearman Catapult'], towns:[[11,8,'AI','CITY'],[6,17,'PLAYER','HAMLET'],[17,18,null,'VILLAGE']], focus:[11,8], approach:'three-engine siege', briefing:'Three catapults form a powerful but slow siege train. Your southern supply hamlet is exposed to flanking enemies.'},
    {size:[28,20], seats:[[3,4],[23,15],[5,15],[22,4]], army:'Assassin Assassin Archer Archer Swordsman Cleric', foes:['Knight Knight Cleric Archer','Dragon Spearman Cleric','Catapult Swordsman Archer'], towns:[[13,5,null,'CITY'],[13,15,null,'VILLAGE'],[19,12,'AI','HAMLET']], approach:'rival woodland courts', briefing:'Two assassins lead a compact raiding army. Exploit the rival kingdoms fighting in the middle instead of meeting every army head-on.'},
    {size:[26,26], seats:[[4,4],[21,4],[4,20],[21,20],[13,21]], army:'Swordsman Swordsman Spearman Cleric Cleric Catapult Stockade', foes:['Dragon Archer Cleric','Knight Knight Archer Cleric','Assassin Assassin Spearman','Catapult Knight Archer'], towns:[[12,13,null,'CITY'],[8,8,'PLAYER','HAMLET'],[8,17,'AI2','HAMLET'],[18,12,null,'VILLAGE']], focus:[12,13], approach:'healer-supported strongpoint', briefing:'Bring a durable army and two healers to the central city. Allied cavalry comes from the southwest as three enemy armies converge.'},
    {size:[30,22], seats:[[4,17],[25,4],[14,4],[24,16],[14,17]], army:'Dragon Dragon Knight Cleric Archer Spearman', foes:['Knight Spearman Archer Cleric','Catapult Archer Cleric','Assassin Knight Spearman','Dragon Archer Cleric'], towns:[[8,11,null,'VILLAGE'],[20,4,'AI','HAMLET'],[19,16,'AI3','HAMLET']], approach:'dragon expedition', briefing:'Two dragons give you reach across the water, but your Crown and infantry still need the causeways. Enemy support islands guard the red Crown.'},
    {size:[28,24], seats:[[12,12],[4,4],[18,13],[23,4],[22,20]], army:'Knight Knight Spearman Archer Cleric Cleric Castle', foes:['Assassin Knight Archer','Swordsman Archer Catapult','Dragon Spearman Cleric','Knight Knight Archer'], towns:[[9,15,'PLAYER','HAMLET'],[15,8,null,'VILLAGE'],[5,19,null,'HAMLET']], approach:'encircled oasis', briefing:'Begin near the middle of the desert with a castle and two healers. Protect the supply hamlet while your eastern ally relieves the encirclement.'},
    {size:[32,18], seats:[[3,12],[27,11],[10,4],[18,12],[26,4]], army:'Dragon Catapult Catapult Swordsman Knight Cleric Archer', foes:['Castle Knight Archer Cleric','Assassin Archer Cleric','Dragon Spearman Archer','Knight Catapult Cleric'], towns:[[8,12,null,'HAMLET'],[15,7,null,'CITY'],[24,14,'AI','VILLAGE'],[21,4,'AI4','HAMLET']], approach:'long coastal offensive', briefing:'A mixed siege army must travel the length of the coast. Rival kingdoms contest the middle port; red has an inland supply village.'},
    {size:[29,29], seats:[[13,24],[14,5],[5,9],[23,10],[14,15]], army:'Dragon Catapult Catapult Knight Swordsman Assassin Cleric Cleric', foes:['Heavy Fortress Dragon Knight Cleric Archer','Knight Assassin Archer Cleric','Dragon Spearman Catapult','Castle Swordsman Archer Cleric'], towns:[[9,22,'PLAYER','VILLAGE'],[19,22,null,'HAMLET'],[14,10,'AI','CITY'],[5,16,'AI2','HAMLET'],[23,17,'AI3','HAMLET']], approach:'the final breach', briefing:'Your largest combined army enters from the southern rim. Purple guards the inner basin; break through to the red throne beyond the northern fortress.'}
  ]
];

function buildCampaignScenario(chapter, mission, ordinal, tier) {
  const [name,biome,aiCount,goal,ally,coalition,targetName,story]=mission;
  const plan=CAMPAIGN_BATTLE_PLANS[tier][ordinal-1];
  const [cols,rows]=plan.size;
  const rng=createScenarioRng(`${chapter.id}:${ordinal}:chronicles3`);
  const grid=Array(cols*rows).fill(null), teams=['PLAYER',...aiTeamNames.slice(0,aiCount)];
  const anchors=Object.fromEntries(teams.map((t,i)=>[t,{col:plan.seats[i][0],row:plan.seats[i][1]}]));
  const enemies=teams.filter(t=>t!=='PLAYER'&&!(ally&&t==='AI2'));
  const center={col:Math.floor(cols/2),row:Math.floor(rows/2)};
  const islands=[...Object.values(anchors),center,{col:cols*.5,row:3},{col:cols*.6,row:rows-4}];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const n=rng(),x=c/cols,y=r/rows;let type=null;
    switch(biome){
      case 'meadow':type=Math.abs(c-cols*.55-Math.sin(r*.6)*1.3)<.8?'WATER':n<.15?'WOODS':n<.24?'FARM':null;break;
      case 'forest':type=n<.74?'WOODS':n<.79?'MOUNTAIN':null;break;
      case 'marsh':type=n<.63?'SWAMP':n<.74?'WATER':n<.80?'WOODS':null;break;
      case 'islands':type=islands.some(a=>Math.hypot((c-a.col)*.9,r-a.row)<2.7)?(n<.25?'WOODS':null):'WATER';break;
      case 'desert':type=n<.76?'DESERT':n<.85?'MOUNTAIN':null;break;
      case 'mountain':type=n<.70?'MOUNTAIN':n<.83?'WOODS':null;break;
      case 'river':type=Math.abs(c-cols*.5-Math.sin(r*.4+ordinal)*2)<1.3?'WATER':n<.35?'WOODS':null;break;
      case 'delta':type=Math.abs(c-cols*(.45+.2*y)-Math.sin(r*.5))<1||Math.abs(c-cols*(.55-.3*y))<1?'WATER':n<.38?'SWAMP':null;break;
      case 'coast':type=y<.2+.1*Math.sin(c*.45+ordinal)?'WATER':n<.32?'DESERT':n<.48?'WOODS':null;break;
      case 'caldera':{const d=Math.hypot((x-.5)*1.3,y-.5);type=d>.22&&d<.42?'MOUNTAIN':d<.18?'DESERT':n<.3?'WOODS':null;break;}
    }
    grid[r*cols+c]=type;
  }
  // Every capital and objective has a traversable land/causeway route. Roads
  // also offer shelter from desert attrition and access for marsh-blocked units.
  const road=(from,to)=>{let c=from.col,r=from.row;while(c!==to.col||r!==to.row){const k=r*cols+c;grid[k]=grid[k]==='WATER'?'BRIDGE':null;if(c!==to.col)c+=Math.sign(to.col-c);else r+=Math.sign(to.row-r);}grid[r*cols+c]=null;};
  // Link nearby holdings, rather than repeating a capital-to-center star.
  // A connected road tree preserves foot access even through island maps.
  const towns=teams.map((team,i)=>({...anchors[team],type:team==='PLAYER'?(ordinal===2?'HAMLET':tier===0?'VILLAGE':'CITY'):tier===0?'VILLAGE':'CITY',owner:team,name:team==='AI'?'Red Keep':`${team} capital`}));
  for(const [col,row,owner,type] of plan.towns)towns.push({col,row,owner,type});
  const targetPoint=plan.focus?{col:plan.focus[0],row:plan.focus[1]}:anchors.AI;
  const targetTown=towns.find(t=>t.col===targetPoint.col&&t.row===targetPoint.row);
  if(targetName&&targetTown)targetTown.name=targetName;
  const connected=[towns[0]],remaining=towns.slice(1);
  while(remaining.length){
    let best=null;
    for(const a of connected)for(let i=0;i<remaining.length;i++){
      const b=remaining[i],d=Math.abs(a.col-b.col)+Math.abs(a.row-b.row);
      if(!best||d<best.d)best={a,b,i,d};
    }
    road(best.a,best.b);connected.push(best.b);remaining.splice(best.i,1);
  }
  const startingUnits={},occupied=new Set();
  for(const [teamIndex,team] of teams.entries()){
    const a=anchors[team];startingUnits[team]=[];
    const army=(team==='PLAYER'?plan.army:plan.foes[teamIndex-1]).replace(/Heavy Fortress/g,'Heavy_Fortress').split(' ').map(t=>t.replace('_',' '));
    // Rear placement protects the Crown; front ranks face the nearest enemy.
    const opposition=teams.filter(t=>t!==team&&!((team==='PLAYER'&&t==='AI2'||team==='AI2'&&t==='PLAYER')&&ally));
    const opponent=opposition.map(t=>anchors[t]).sort((x,y)=>Math.hypot(x.col-a.col,x.row-a.row)-Math.hypot(y.col-a.col,y.row-a.row))[0];
    const dx=opponent.col-a.col,dy=opponent.row-a.row;
    const candidates=[];
    for(let r=1;r<rows-1;r++)for(let c=1;c<cols-1;c++){
      const d=Math.hypot(c-a.col,r-a.row);
      if(d<=3&&!occupied.has(r*cols+c)&&!towns.some(t=>t.owner!==team&&t.col===c&&t.row===r))candidates.push({col:c,row:r,d,front:(c-a.col)*dx+(r-a.row)*dy});
    }
    const distance=Math.hypot(dx,dy)||1;
    const rear={col:a.col-dx/distance*1.5,row:a.row-dy/distance*1.5};
    const fortresses=['Stockade','Castle','Heavy Fortress'];
    for(const type of ['Crown',...army]){
      const score=p=>type==='Crown'?Math.hypot(p.col-rear.col,p.row-rear.row):fortresses.includes(type)?p.d:p.d-p.front/distance*.3;
      candidates.sort((x,y)=>score(x)-score(y));
      const point=candidates.shift();
      if(!point)throw new Error(`No deployment space in ${name}`);
      const k=point.row*cols+point.col;occupied.add(k);road(a,point);grid[k]=null;
      startingUnits[team].push({id:`${chapter.id}-${ordinal}-${team}-${startingUnits[team].length}`,type,col:point.col,row:point.row});
    }
  }
  // Springs support campaigns with long approaches and attrition terrain.
  for(const town of towns.filter(t=>t.owner===null).slice(0,biome==='desert'?3:1)){
    const spring={col:town.col,row:Math.min(rows-2,town.row+1)};
    const k=spring.row*cols+spring.col;
    if(!occupied.has(k)&&!towns.some(t=>t.col===spring.col&&t.row===spring.row)){road(town,spring);grid[k]='FOUNTAIN';}
  }
  const diplomacy=createDefaultWarDiplomacy(teams);
  const pact=(a,b)=>{
    diplomacy.warDeclarations=diplomacy.warDeclarations.filter(w=>!([w.attacker,w.target].includes(a)&&[w.attacker,w.target].includes(b)));
    diplomacy.trust[a][b]=diplomacy.trust[b][a]=85;
    diplomacy.treaties.push({id:`${chapter.id}-${ordinal}-${a}-${b}`,type:'DEFENSIVE_PACT',participants:[a,b],turnsRemaining:999,active:true,createdTurn:0,scenarioStart:true});
  };
  if(ally)pact('PLAYER','AI2');
  if(coalition)for(let i=0;i<enemies.length;i++)for(let j=i+1;j<enemies.length;j++)pact(enemies[i],enemies[j]);
  const target=targetPoint;
  const victoryCondition={type:goal,targetTeam:'AI',targetName,holdCol:target.col,holdRow:target.row,holdTurns:3+tier,surviveTurns:tier===2?18:12,targetUnitId:startingUnits.AI.find(u=>u.type==='Crown').id};
  const objective=goal==='CAPTURE_TOWN'?`Capture ${targetName} (${target.col}, ${target.row}).`:goal==='KILL_CROWN'?'Kill the red kingdom’s Crown.':goal==='ANNIHILATE_TEAM'?'Eliminate the red kingdom’s units and settlements.':goal==='HOLD_TILE'?`Hold ${targetName} (${target.col}, ${target.row}) for ${3+tier} rounds.`:`Survive until turn ${victoryCondition.surviveTurns}.`;
  return {id:`${chapter.id}-${ordinal}`,name,biome,approach:plan.approach,armySummary:plan.army,difficulty:chapter.difficulty,aiCount,mapSize:{cols,rows},startingUnits,startingResources:Object.fromEntries(teams.map(t=>[t,{gold:0,materials:0}])),settlements:towns,terrain:grid.flatMap((type,i)=>type?[{type,col:i%cols,row:Math.floor(i/cols)}]:[]),diplomacy,victoryCondition,victory:objective,description:`${plan.briefing}\n${story}\n${ally?'Green is your ally.':'You have no starting allies.'} ${coalition?'Enemy kingdoms are allied against you.':enemies.length>1?'Enemy kingdoms also fight one another.':'One enemy kingdom stands against you.'}\nProtect your Crown: losing it ends the mission.`,ally,coalition};
}
function buildCampaignCatalog(){return CAMPAIGN_CHAPTERS.map((chapter,tier)=>({...chapter,scenarios:chapter.missions.map((m,i)=>buildCampaignScenario(chapter,m,i+1,tier))}));}
