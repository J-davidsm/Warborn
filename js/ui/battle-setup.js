/* Shared settings editor. Guests use the same controls to propose a complete
   draft; only an explicit host acceptance replaces the agreed settings. */
const BattleSetup=(()=>{
 const $=id=>document.getElementById(id),labels={GRASS:'Grassland',WOODS:'Forest',MOUNTAIN:'Mountains',WATER:'Islands',SWAMP:'Marsh',DESERT:'Desert',HAMLET:'Village',VILLAGE:'Town',CITY:'City'};
 let rendered='',draft=null;
 const total=o=>Object.values(o).reduce((a,b)=>a+b,0);
 function render(state){
  $('onlineLobby').classList.toggle('generation-open',state.active&&!state.playing&&state.mode!=='coop');
  for(const [id,mode]of [['lobbyCompetitive','competitive'],['lobbyCoop','coop']]){const b=$(id);b.disabled=state.active;b.setAttribute('aria-pressed',String((state.active?state.mode:$('lobbyMode').value)===mode));}
  const box=$('battleSetup');box.hidden=!state.active||state.playing||state.mode==='coop';if(box.hidden){rendered='';return;}
  const g=state.generation;if(!g)return;
  const key=JSON.stringify([g,state.host,state.capacity]);if(key===rendered)return;rendered=key;draft=JSON.parse(JSON.stringify(g.settings));
  box.replaceChildren();const heading=document.createElement('h3');heading.textContent='Generate battlefield';box.append(heading);
  const note=document.createElement('p');note.textContent=state.host?'Choose the same starting forces for every side, generate a map, then ask everyone to agree.':'Change the controls to suggest settings to the host. Your suggestion does not change the agreed map until the host accepts it.';box.append(note);
  const layout=document.createElement('div');layout.className='battle-settings';box.append(layout);
  function select(label,values,value,change){const field=document.createElement('label');field.textContent=label;const input=document.createElement('select');for(const [v,name]of values){const o=document.createElement('option');o.value=v;o.textContent=name;input.append(o);}input.value=value;input.onchange=()=>change(input.value);field.append(input);layout.append(field);}
  const submit=()=>{if(BattleGenerator.valid(draft))OnlineMatch.changeSettings(draft);else $('generationDraftStatus').textContent='Choose 1–12 units and 1–5 settlements per side.';};
  select('Map size',Array.from({length:13},(_,i)=>[i+8,`${i+8} × ${i+8}`]),draft.size,v=>{draft.size=Number(v);submit();});
  select('Majority terrain',BattleGenerator.terrains.map(t=>[t,labels[t]]),draft.terrain,v=>{draft.terrain=v;submit();});
  function counters(title,names,property,max){const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;group.append(legend);group.className='battle-counts';layout.append(group);
   for(const name of names){const label=document.createElement('label');label.textContent=labels[name]||name;
    const input=document.createElement('input');input.type='number';input.min=0;input.max=max;input.step=1;input.value=draft[property][name]||0;input.setAttribute('aria-label',(labels[name]||name)+' per side');
    input.onchange=()=>{draft[property][name]=Number(input.value);submit();};label.append(input);group.append(label);}
  }
  counters('Starting army · maximum 12 per side',BattleGenerator.unitNames,'army',12);counters('Starting settlements · maximum 5 per side',['HAMLET','VILLAGE','CITY'],'settlements',5);
  const summary=document.createElement('p');summary.id='generationDraftStatus';summary.textContent=`Every side: ${total(g.settings.army)} units · ${total(g.settings.settlements)} settlements · 2-minute turns`;box.append(summary);
  if(g.suggestion){const proposal=document.createElement('div');proposal.className='battle-suggestion';const s=g.suggestion.settings;
   const text=document.createElement('p');text.textContent=`${OnlineMatch.playerName(g.suggestion.team)} suggests ${s.size} × ${s.size}, ${labels[s.terrain]}. Army: ${Object.entries(s.army).filter(([,v])=>v).map(([k,v])=>`${v} ${k}`).join(', ')}. Settlements: ${Object.entries(s.settlements).filter(([,v])=>v).map(([k,v])=>`${v} ${labels[k]}`).join(', ')}.`;proposal.append(text);
   if(state.host)for(const [label,action]of [['Accept suggestion',()=>OnlineMatch.acceptSuggestion()],['Dismiss',()=>OnlineMatch.dismissSuggestion()]]){const b=document.createElement('button');b.textContent=label;b.onclick=action;proposal.append(b);}box.append(proposal);
  }
  const generate=document.createElement('button');generate.textContent=g.seed?'Generate another map':'Generate';generate.disabled=!state.host;generate.onclick=()=>OnlineMatch.generateBattle();box.append(generate);
  const message=document.createElement('p');message.setAttribute('role','status');message.textContent=g.error||(g.seed?'Map generated. Each player must agree to these settings.':'Generate a map before agreeing.');box.append(message);
  if(g.seed){const map=BattleGenerator.generate(g.seed,state.capacity,g.settings),canvas=document.createElement('canvas');canvas.width=360;canvas.height=280;canvas.setAttribute('aria-label','Symmetric battlefield preview');box.append(canvas);draw(canvas,map);}
 }
 function draw(canvas,map){const ctx=canvas.getContext('2d'),s=Math.min(330/map.cols,250/map.rows),colors={GRASS:'#536b3b',WOODS:'#1f452d',MOUNTAIN:'#858079',WATER:'#25496b',BRIDGE:'#b19b75',SWAMP:'#505a36',DESERT:'#b29662'},teams=['#4597ed','#e25656','#d6b44e','#b36cd6'];ctx.fillStyle='#101820';ctx.fillRect(0,0,360,280);
  map.terrain.forEach((t,i)=>{if(t==='VOID')return;const x=15+(i%map.cols)*s,y=12+Math.floor(i/map.cols)*s;ctx.fillStyle=colors[t]||colors.GRASS;ctx.fillRect(x,y,s-.5,s-.5);const home=map.settlements[i];if(home){ctx.fillStyle=teams[['PLAYER','PLAYER2','PLAYER3','PLAYER4'].indexOf(home.owner)];ctx.fillRect(x+2,y+2,s-4,s-4);}});
  for(const u of map.units){ctx.fillStyle=teams[['PLAYER','PLAYER2','PLAYER3','PLAYER4'].indexOf(u.team)];ctx.beginPath();ctx.arc(15+(u.col+.5)*s,12+(u.row+.5)*s,s*.22,0,Math.PI*2);ctx.fill();}
 }
 document.addEventListener('DOMContentLoaded',()=>{for(const [id,value]of [['lobbyCompetitive','competitive'],['lobbyCoop','coop']])$(id).onclick=()=>{if(OnlineMatch.active)return;$('lobbyMode').value=value;$('lobbyMode').onchange();};});
 return {render};
})();
