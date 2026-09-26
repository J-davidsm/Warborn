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

function buildCampaignScenario(chapter, mission, ordinal, tier) {
  const [name,biome,aiCount,goal,ally,coalition,targetName,story]=mission;
  const cols=18+tier*4, rows=16+tier*4;
  const rng=createScenarioRng(`${chapter.id}:${ordinal}:chronicles1`);
  const grid=Array(cols*rows).fill(null), teams=['PLAYER',...aiTeamNames.slice(0,aiCount)];
  const anchors={PLAYER:{col:3,row:Math.floor(rows/2)}};
  const enemies=teams.filter(t=>t!=='PLAYER'&&!(ally&&t==='AI2'));
  enemies.forEach((team,i)=>anchors[team]={col:cols-4-(i%2)*4,row:Math.round(3+i*(rows-7)/Math.max(1,enemies.length-1))});
  if(ally)anchors.AI2={col:4,row:rows-4};
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
  Object.values(anchors).forEach(a=>road(a,center));
  const towns=[],startingUnits={},occupied=new Set();
  const put=(team,type,c,r)=>{while(occupied.has(r*cols+c)){c++;if(c>=cols-1){c=1;r++;}} occupied.add(r*cols+c);grid[r*cols+c]=null;const id=`${chapter.id}-${ordinal}-${team}-${type}-${startingUnits[team].length}`;startingUnits[team].push({id,type,col:c,row:r});return id;};
  for(const team of teams){
    const a=anchors[team],friendly=team==='PLAYER'||(ally&&team==='AI2');
    startingUnits[team]=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=2;dx++)grid[(a.row+dy)*cols+a.col+dx]=null;
    towns.push({col:a.col,row:a.row,type:friendly?'CITY':tier===0?'VILLAGE':'CITY',owner:team,name:team==='AI'?targetName||'Red Keep':`${team} capital`});
    towns.push({col:a.col-1,row:a.row+2,type:'HAMLET',owner:team});road(a,{col:a.col-1,row:a.row+2});
    const army=friendly?['Spearman','Knight','Archer','Cleric','Crown',tier===2?'Dragon':'Soldier']:tier===0?['Soldier','Archer','Crown']:tier===1?['Spearman','Knight','Archer','Cleric','Crown']:['Swordsman','Knight','Assassin','Cleric','Crown','Dragon'];
    const offsets=[[0,0],[1,0],[1,-1],[0,1],[-1,0],[2,0]];
    army.forEach((type,i)=>put(team,type,a.col+offsets[i][0],a.row+offsets[i][1]));
    if(tier>0&&['mountain','desert','caldera'].includes(biome)){
      put(team,friendly?'Catapult':'Castle',a.col+1,a.row+1);
    }
  }
  grid[center.row*cols+center.col]=null;
  towns.push({...center,type:'VILLAGE',owner:null,name:goal==='HOLD_TILE'?targetName:'Crossroads'});
  const spring={col:center.col,row:center.row+2};road(center,spring);grid[spring.row*cols+spring.col]='FOUNTAIN';
  const diplomacy=createDefaultWarDiplomacy(teams);
  const pact=(a,b)=>{
    diplomacy.warDeclarations=diplomacy.warDeclarations.filter(w=>!([w.attacker,w.target].includes(a)&&[w.attacker,w.target].includes(b)));
    diplomacy.trust[a][b]=diplomacy.trust[b][a]=85;
    diplomacy.treaties.push({id:`${chapter.id}-${ordinal}-${a}-${b}`,type:'DEFENSIVE_PACT',participants:[a,b],turnsRemaining:999,active:true,createdTurn:0,scenarioStart:true});
  };
  if(ally)pact('PLAYER','AI2');
  if(coalition)for(let i=0;i<enemies.length;i++)for(let j=i+1;j<enemies.length;j++)pact(enemies[i],enemies[j]);
  const target=anchors.AI;
  const victoryCondition={type:goal,targetTeam:'AI',targetName,holdCol:goal==='HOLD_TILE'?center.col:target.col,holdRow:goal==='HOLD_TILE'?center.row:target.row,holdTurns:3+tier,surviveTurns:tier===2?18:12,targetUnitId:startingUnits.AI.find(u=>u.type==='Crown').id};
  const objective=goal==='CAPTURE_TOWN'?`Capture ${targetName} (${target.col}, ${target.row}).`:goal==='KILL_CROWN'?'Kill the red kingdom’s Crown.':goal==='ANNIHILATE_TEAM'?'Eliminate the red kingdom’s units and settlements.':goal==='HOLD_TILE'?`Hold ${targetName} (${center.col}, ${center.row}) for ${3+tier} rounds.`:`Survive until turn ${victoryCondition.surviveTurns}.`;
  return {id:`${chapter.id}-${ordinal}`,name,biome,difficulty:chapter.difficulty,aiCount,mapSize:{cols,rows},startingUnits,startingResources:Object.fromEntries(teams.map(t=>[t,{gold:0,materials:0}])),settlements:towns,terrain:grid.flatMap((type,i)=>type?[{type,col:i%cols,row:Math.floor(i/cols)}]:[]),diplomacy,victoryCondition,victory:objective,description:`${story}\n${ally?'Green is your ally.':'You have no starting allies.'} ${coalition?'Enemy kingdoms are allied against you.':enemies.length>1?'Enemy kingdoms also fight one another.':'One enemy kingdom stands against you.'}\nProtect your Crown: losing it ends the mission.`,ally,coalition};
}
function buildCampaignCatalog(){return CAMPAIGN_CHAPTERS.map((chapter,tier)=>({...chapter,scenarios:chapter.missions.map((m,i)=>buildCampaignScenario(chapter,m,i+1,tier))}));}
