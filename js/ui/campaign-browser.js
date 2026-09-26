let selectedCampaignChapter=0;
let campaignCatalogCache=null;
let workshopCollection={name:'Custom Scenarios',scenarios:[]};
function getCampaignCatalog(){return campaignCatalogCache ||= buildCampaignCatalog();}
function openScenarioWorkshop(){
  if(campaignMode.campaignData.id)campaignMode.campaignData=workshopCollection;
  document.getElementById('campaignPage').classList.remove('visible');
  document.getElementById('mainMenu').classList.add('hidden');
  document.getElementById('scenarioWorkshop').classList.add('visible');
  document.getElementById('campaignNameInput').value=campaignMode.campaignData.name;
  renderScenariosEditor();
}
function closeScenarioWorkshop(){
  workshopCollection=campaignMode.campaignData;
  document.getElementById('scenarioWorkshop').classList.remove('visible');
  document.getElementById('mainMenu').classList.remove('hidden');
}
function renderCampaignBrowser(){
  const catalog=getCampaignCatalog(),choices=document.getElementById('campaignChoices');choices.replaceChildren();
  catalog.forEach((chapter,i)=>{
    const button=document.createElement('button');button.className='campaign-choice'+(i===selectedCampaignChapter?' selected':'');
    button.setAttribute('aria-pressed',String(i===selectedCampaignChapter));
    const kicker=document.createElement('small');kicker.textContent=`CAMPAIGN ${i+1} · ${chapter.difficulty.toUpperCase()} · 7 MISSIONS`;
    const title=document.createElement('strong');title.textContent=chapter.name;
    const description=document.createElement('span');description.textContent=chapter.subtitle;
    button.append(kicker,title,description);button.onclick=()=>{selectedCampaignChapter=i;renderCampaignBrowser();};choices.append(button);
  });
  const chapter=catalog[selectedCampaignChapter];
  document.getElementById('campaignMissionHeading').textContent=`${chapter.name} — choose your battle`;
  const missions=document.getElementById('campaignMissions');missions.replaceChildren();
  chapter.scenarios.forEach((scenario,i)=>{
    const card=document.createElement('article');card.className='campaign-mission';
    const canvas=document.createElement('canvas');canvas.width=260;canvas.height=180;canvas.setAttribute('aria-label',`${scenario.biome} map preview`);drawCampaignPreview(canvas,scenario);
    const content=document.createElement('div');
    const tag=document.createElement('small');tag.textContent=`${String(i+1).padStart(2,'0')} / ${scenario.biome.toUpperCase()} · ${scenario.aiCount} AI${scenario.aiCount>1?'s':''}`;
    const title=document.createElement('h3');title.textContent=scenario.name;
    const objective=document.createElement('p');objective.className='mission-objective';objective.textContent=scenario.victory;
    const relations=document.createElement('p');relations.className='mission-relations';relations.textContent=`${scenario.ally?'Green ally':'No starting allies'} · ${scenario.coalition?'Enemy coalition':scenario.aiCount-(scenario.ally?1:0)>1?'Rival kingdoms':'One enemy kingdom'}`;
    const start=document.createElement('button');start.textContent='Play mission';start.onclick=()=>playCampaignMission(selectedCampaignChapter,i);
    content.append(tag,title,objective,relations,start);card.append(canvas,content);missions.append(card);
  });
}
function drawCampaignPreview(canvas,scenario){
  const ctx=canvas.getContext('2d'),{cols,rows}=scenario.mapSize,w=canvas.width/cols,h=canvas.height/rows;
  ctx.fillStyle='#819765';ctx.fillRect(0,0,canvas.width,canvas.height);
  const colors={WOODS:'#a1c45f',SWAMP:'#455946',WATER:'#386783',BRIDGE:'#d4b389',MOUNTAIN:'#858486',DESERT:'#d9b36e',FARM:'#bbae53',FOUNTAIN:'#76d7d4'};
  for(const tile of scenario.terrain){ctx.fillStyle=colors[tile.type];ctx.fillRect(tile.col*w,tile.row*h,w+.5,h+.5);}
  const teams={PLAYER:'#488cff',AI:'#f14f5b',AI2:'#4be17a',AI3:'#ffe15a',AI4:'#ed65db'};
  for(const town of scenario.settlements){ctx.fillStyle=teams[town.owner]||'#fff';ctx.strokeStyle='#182223';ctx.lineWidth=1.5;ctx.fillRect(town.col*w-2,town.row*h-2,w+4,h+4);ctx.strokeRect(town.col*w-2,town.row*h-2,w+4,h+4);}
}
function playCampaignMission(chapterIndex,missionIndex){
  if(!campaignMode.campaignData.id)workshopCollection=campaignMode.campaignData;
  campaignMode.campaignData=clonePlain(getCampaignCatalog()[chapterIndex]);
  campaignMode.currentScenarioIndex=missionIndex;campaignMode.active=true;gameMode='campaign';opponentType='AI';
  const select=document.getElementById('gameModeSelect');if(select)select.value='campaign';
  closeCampaignPage(false);document.getElementById('mainMenu').classList.add('hidden');
  try{SoundManager.startBackgroundMusic();}catch(e){}
  loadCurrentScenario();updateCampaignUI();
}

function fitMapToViewport(){
  const b=getMapWorldBounds(),o=getMapOrigin(),available=Math.max(320,document.getElementById('panel').getBoundingClientRect().left);
  zoomLevel=targetZoom=Math.max(minZoom,Math.min(1,(available-100)/b.width,(height-160)/b.height));
  panX=targetPanX=available/2-o.x-(b.x+b.width/2)*targetZoom;
  panY=targetPanY=(height+40)/2-o.y-(b.y+b.height/2)*targetZoom;
  clampPanToMap();
}
