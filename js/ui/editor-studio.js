// Illustrated brushes reuse the same terrain surfaces and recolored unit sprites as the board.
const EditorStudio = (() => {
  const $ = id => document.getElementById(id);
  const terrainBrushes = {woodsBtn:['WOODS','Forest'],mountainBtn:['MOUNTAIN','Mountain'],swampBtn:['SWAMP','Marsh'],desertBtn:['DESERT','Desert'],waterBtn:['WATER','Water'],fountainBtn:['FOUNTAIN','Fountain'],farmBtn:['FARM','Farm'],bridgeBtn:['BRIDGE','Bridge'],clearTerrainBtn:['GRASS','Grassland']};
  const unitBrushes = {soldierBtn:'Soldier',archerBtn:'Archer',knightBtn:'Knight',catapultBtn:'Catapult',spearmanBtn:'Spearman',swordsmanBtn:'Swordsman',assassinBtn:'Assassin',dragonBtn:'Dragon',clericBtn:'Cleric',crownBtn:'Crown',stockadeBtn:'Stockade',castleBtn:'Castle',heavyFortressBtn:'Heavy Fortress'};
  const townBrushes = {hamletBtn:['HAMLET','Village'],villageBtn:['VILLAGE','Town'],cityBtn:['CITY','City'],portBtn:['PORT','Port']};
  let signature='',sideSignature='',step=-1;
  const lessons = [
    ['aiPlayerControls','Kingdoms in your battle','Use − and + to choose how many AI kingdoms will fight. Each kingdom appears in the side portraits below.'],
    ['mapSizeContent','Size your map','Use − and + to resize the map. Your new map starts as 4 × 4 grassland. Shrinking removes units and terrain outside the new edges.'],
    ['terrainContent','Paint the landscape','Choose a pictured terrain hex, then click map hexes to paint. Grassland restores plain ground. Shift-click fills the whole map with the selected terrain.','terrain'],
    ['editorSidePicker','Choose a side','Click a leader portrait to select a kingdom. Its colored border and the unit hex colors show who you are placing. The crown on the cushion represents your side.'],
    ['settlementsContent','Place settlements','Choose a village, town, city, or port, then click the map. It belongs to your selected side. Leave at least one hex between settlements. Clear removes a settlement.','settlements'],
    ['unitsContent','Build the starting armies','Choose a unit image and click empty hexes to place it for the selected side. In unit mode, click an existing unit to remove it. Add armies or settlements for every side you want to play.','units'],
    ['startingDiplomacyEditor','Set starting diplomacy','Choose At War, Neutral, or Defensive Pact for each pair of kingdoms. These starting relationships are saved with the scenario.'],
    ['victoryContent','Choose the objective','Set how the battle is won: take a town, protect a Crown, survive, or defeat rival kingdoms. Configure the target below the objective.','victory'],
    ['editorSaveControls','Save and play','Give your level a name and choose Save Named. Find it later under Play solo → Play saved levels. Save Scenario also keeps a quick save. Use Play Mode when you are ready; after your first move you must restart to edit.']
  ];
  function shape(ctx) {ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/6;const x=60+54*Math.cos(a),y=60+54*Math.sin(a);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}
  function brush(id,label) {
    const button=$(id);if(!button)return null;
    if(!button.querySelector('canvas')){button.replaceChildren();button.classList.add('editor-brush');button.setAttribute('aria-label',label);const canvas=document.createElement('canvas');canvas.width=canvas.height=120;canvas.setAttribute('aria-hidden','true');const text=document.createElement('span');text.textContent=label;button.append(canvas,text);}
    return button.querySelector('canvas');
  }
  function paint(canvas,image,unit=false) {
    if(!canvas)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,120,120);ctx.save();shape(ctx);ctx.fillStyle=unit?getTeamColorHex(selectedTeam || 'PLAYER'):'#526d44';ctx.globalAlpha=unit?.55:1;ctx.fill();ctx.globalAlpha=1;ctx.clip();
    if(image?.width){const ratio=unit?Math.min(108/image.width,108/image.height):Math.max(120/image.width,120/image.height);ctx.drawImage(image,60-image.width*ratio/2,60-image.height*ratio/2,image.width*ratio,image.height*ratio);}
    ctx.restore();shape(ctx);ctx.strokeStyle=unit?getTeamColorHex(selectedTeam || 'PLAYER'):'#ad9459';ctx.lineWidth=3;ctx.stroke();
  }
  function chooseSide(team) {
    if(!getActiveTeams().includes(team))return;
    selectedTeam=team;$('teamSelect').value=team;
    if(placingUnitType)placingUnitTeam=team;
    $('teamSelect').dispatchEvent(new Event('change',{bubbles:true}));
    signature='';sideSignature='';refresh();
  }
  function refresh() {
    if(!isEditorMode||!$('editorSidePicker')){if(step>=0)stopTutorial();return;}
    const teams=getActiveTeams(),key=teams.map(team=>team+':'+WarbornLeaders.get(team)[0]).join('|')+':'+selectedTeam;
    if(sideSignature!==key){
      sideSignature=key;const host=$('editorSidePicker');host.replaceChildren();
      for(const team of teams){const name=getTeamDisplayName(team),button=document.createElement('button');button.type='button';button.className='editor-side';button.style.setProperty('--side-color',getTeamColorHex(team));button.setAttribute('aria-label',`Place for ${name}`);button.setAttribute('aria-pressed',String(team===selectedTeam));button.title=name;
        const image=document.createElement('img');image.src=isAITeam(team)?`assets/leaders/${WarbornLeaders.get(team)[0]}.png`:'assets/leaders/player-crown.png';image.alt='';const text=document.createElement('span');text.textContent=name;button.append(image,text);button.onclick=()=>chooseSide(team);host.append(button);
      }
    }
    const next=selectedTeam+':'+TERRAIN_V2.revision+':'+Object.keys(IMAGES).length;
    if(signature!==next){signature=next;
      for(const [id,[type,label]] of Object.entries(terrainBrushes))paint(brush(id,label),TERRAIN_V2.images[type]?.[0]);
      for(const [id,name] of Object.entries(unitBrushes))paint(brush(id,name),UnitPresentation.sprite({name,team:selectedTeam}),true);
      for(const [id,[type,label]] of Object.entries(townBrushes)){
        const canvas=brush(id,label);paint(canvas,TERRAIN_V2.images[type==='PORT'?'WATER':'GRASS']?.[0]);
        const img=IMAGES['settlement_'+(type==='PORT'?'VILLAGE':type)];if(img?.width){const ctx=canvas.getContext('2d'),s=Math.min(105/img.width,100/img.height);ctx.drawImage(img,60-img.width*s/2,58-img.height*s/2,img.width*s,img.height*s);}
      }
    }
    for(const [id,[type]] of Object.entries(terrainBrushes))$(id).setAttribute('aria-pressed',String(placingTerrain===(type==='GRASS'?'CLEAR':type)));
    for(const [id,name] of Object.entries(unitBrushes))$(id).setAttribute('aria-pressed',String(placingUnitType===name));
    for(const [id,[type]] of Object.entries(townBrushes))$(id).setAttribute('aria-pressed',String(placingSettlement===type));
    if(step>=0)positionHighlight();
  }
  function stopTutorial(){step=-1;$('editorCoach')?.remove();$('editorCoachHighlight')?.remove();}
  function positionHighlight(){
    const target=$(lessons[step]?.[0]),box=$('editorCoachHighlight');if(!target||!box)return;
    const rect=target.getBoundingClientRect(),panel=$('panel').getBoundingClientRect();
    const top=Math.max(rect.top,panel.top),bottom=Math.min(rect.bottom,panel.bottom);
    box.style.cssText=`left:${rect.left-4}px;top:${top-4}px;width:${rect.width+8}px;height:${Math.max(0,bottom-top)+8}px;`;
  }
  function showStep(){
    if(step>=lessons.length){stopTutorial();return;}
    CommandMenu.open('editor');const [target,title,text,section]=lessons[step];
    if(section){$(section+'Content').classList.remove('collapsed');$(section+'Arrow').classList.remove('collapsed');$(section+'Arrow').textContent='▼';}
    $('editorCoachTitle').textContent=`${step+1} / ${lessons.length} · ${title}`;$('editorCoachText').textContent=text;
    $('editorCoachBack').disabled=step===0;$('editorCoachNext').textContent=step===lessons.length-1?'Finish':'Next';
    $(target)?.scrollIntoView({block:'center',behavior:'instant'});positionHighlight();$('editorCoachNext').focus({preventScroll:true});
  }
  function startTutorial(){
    if(!isEditorMode)return;stopTutorial();step=0;
    const coach=document.createElement('aside');coach.id='editorCoach';coach.setAttribute('aria-label','Editor tutorial');coach.innerHTML='<h3 id="editorCoachTitle"></h3><p id="editorCoachText" aria-live="polite"></p><div><button id="editorCoachBack">Back</button><button id="editorCoachNext">Next</button><button id="editorCoachClose">Close tutorial</button></div>';
    const highlight=document.createElement('div');highlight.id='editorCoachHighlight';highlight.setAttribute('aria-hidden','true');document.body.append(coach,highlight);
    for(const event of ['pointerdown','pointerup','mousedown','mouseup','click','wheel','keydown'])coach.addEventListener(event,e=>e.stopPropagation());
    $('editorCoachBack').onclick=()=>{step=Math.max(0,step-1);showStep();};$('editorCoachNext').onclick=()=>{step++;showStep();};$('editorCoachClose').onclick=stopTutorial;showStep();
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const sides=document.createElement('section');sides.id='editorSides';const heading=document.createElement('h3');heading.textContent='Choose a side';const picker=document.createElement('div');picker.id='editorSidePicker';sides.append(heading,picker);
    $('commandEditor').insertBefore(sides,$('editorControls'));
    $('teamSelect').parentElement.hidden=true;
    $('commandEditor').append($('startingDiplomacyEditor'));
    const saves=document.createElement('section');saves.id='editorSaveControls';saves.append($('levelNameInput'),$('saveNamedLevelBtn'));$('commandEditor').append(saves);
    const tutorial=document.createElement('button');tutorial.id='editorTutorialBtn';tutorial.textContent='Editor tutorial';tutorial.onclick=startTutorial;$('aiPlayerControls').after(tutorial);
    setInterval(refresh,250);
  });
  return {refresh,chooseSide,startTutorial,stopTutorial,lessons};
})();
