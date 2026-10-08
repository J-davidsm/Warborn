// Solo navigation shares the existing scenario loader and saved-level storage.
const SoloMenu = (() => {
  const $ = id => document.getElementById(id);
  function page(name) {
    for (const id of ['mainMenuContent','soloMenuPage','savedScenarioPage','customScenarioPage']) $(id).hidden = id !== name;
    $('mainMenu').classList.remove('hidden');
    $(name).querySelector('button')?.focus();
  }
  function entries() {
    const result = getSavedLevels().map(entry => ({name:entry.name, data:entry.data || entry, example:false}));
    try {
      const quick = JSON.parse(localStorage.getItem('customLevel') || 'null');
      if (quick) result.unshift({name:quick.name || 'Quick save — latest progress', data:quick, example:false});
    } catch (_) { /* An invalid old quick save must not hide named levels. */ }
    return [...result, ...EXAMPLE_SCENARIOS.map(entry => ({...entry, example:true}))];
  }
  function launch(data, edit = false) {
    if (typeof OnlineMatch !== 'undefined' && OnlineMatch.active) return;
    EditorStudio.stopTutorial();
    BattleGuide.dismiss();
    campaignMode.active = false; lastPlayedSavedLevelIndex = null;
    opponentType = 'AI'; gameMode = 'vs-ai'; myRole = 'P1';
    watchGameMode = false; document.body.classList.remove('watch-mode','editor-mode');
    document.getElementById('watchGameBar')?.remove();
    aiTeamNames = ['AI','AI2','AI3','AI4']; maxAIPlayers = 4;
    isEditorMode = edit;
    $('gameModeSelect').value = 'vs-ai';
    applyLevelData(clonePlain(data));
    placingUnitType = placingUnitTeam = placingTerrain = placingSettlement = selectedUnit = null;
    selectedTeam = 'PLAYER';
    $('levelNameInput').value = data.name || '';
    $('placingLabel').textContent = 'Selected: None';
    // Run the existing mode transition so all editor controls agree with the mode.
    isEditorMode = !edit; toggleEditorMode();
    captureScenarioSnapshot();
    $('mainMenu').classList.add('hidden');
    $('campaignPage').classList.remove('visible');
    $('scenarioWorkshop').classList.remove('visible');
    if (edit) CommandMenu.open('editor'); else CommandMenu.close();
    fitMapToViewport();
    if(edit && width > 700) {
      const viewport=getBattleViewport(),bounds=getMapWorldBounds(),origin=getMapOrigin();
      const right=$('panel').getBoundingClientRect().left-18;
      zoomLevel=targetZoom=Math.max(minimumMapZoom(),Math.min(1,(right-viewport.left)/bounds.width,(viewport.bottom-viewport.top)/bounds.height));
      panX=targetPanX=(viewport.left+right)/2-origin.x-(bounds.x+bounds.width/2)*zoomLevel;
      panY=targetPanY=(viewport.top+viewport.bottom)/2-origin.y-(bounds.y+bounds.height/2)*zoomLevel;
      clampPanToMap();
    }
    updateTeamSelector(); updateUI(); CommandMenu.refresh(); EditorStudio.refresh();
    gameInputBlockedUntil = Date.now() + 500;
    SoundManager.startBackgroundMusic();
    if (!edit && isAITeam(currentTeam)) aiTurnTimeoutId = setTimeout(() => aiTakeTurn(currentTeam), 200);
  }
  function emptyScenario() {
    return {mapSize:{cols:4,rows:4}, terrain:Array(16).fill('GRASS'), settlements:Array(16).fill(null),
      units:[], aiPlayerCount:1, diplomacy:{}, startingResources:{}, turnNumber:1,currentTeam:'PLAYER',
      victoryCondition:{type:'ANNIHILATE_ALL'}};
  }
  function makeOwn() { launch(emptyScenario(), true); EditorStudio.startTutorial(); }
  function saved() {
    const list = $('scenarioLibrary'); list.replaceChildren();
    const all = entries();
    for (const [label,example] of [['Your saved levels',false],['Example scenarios',true]]) {
      const heading=document.createElement('h3');heading.textContent=label;list.append(heading);
      const group=all.filter(entry=>entry.example===example);
      if(!group.length){const empty=document.createElement('p');empty.textContent='Your saved scenarios will appear here.';list.append(empty);}
      for(const entry of group){
        const card=document.createElement('article');card.className='saved-scenario-card';
        const title=document.createElement('h4');title.textContent=entry.name;
        const detail=document.createElement('p');detail.textContent=`${entry.data.mapSize.cols} × ${entry.data.mapSize.rows} · ${entry.data.aiPlayerCount || 1} AI kingdoms`;
        const play=document.createElement('button');play.textContent='Play';play.setAttribute('aria-label',`Play ${entry.name}`);play.onclick=()=>launch(entry.data);
        const edit=document.createElement('button');edit.textContent='Edit a copy';edit.setAttribute('aria-label',`Edit ${entry.name}`);edit.onclick=()=>{const copy=clonePlain(entry.data);delete copy.progressCheckpoint;delete copy.scenarioPlayStarted;launch(copy,true);$('levelNameInput').value=entry.name+' — copy';};
        card.append(title,detail,play,edit);list.append(card);
      }
    }
    page('savedScenarioPage');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    // Returning from a battle, campaign, or generator always shows the three main choices.
    new MutationObserver(() => {
      if($('mainMenu').classList.contains('hidden')) {
        for(const id of ['mainMenuContent','soloMenuPage','savedScenarioPage','customScenarioPage']) $(id).hidden = id !== 'mainMenuContent';
      }
    }).observe($('mainMenu'), {attributes:true,attributeFilter:['class']});
    $('menuSoloBtn').onclick=()=>page('soloMenuPage');
    $('menuSavedBtn').onclick=saved;
    $('menuCustomBtn').onclick=()=>page('customScenarioPage');
    document.querySelectorAll('[data-solo-back]').forEach(button=>button.onclick=()=>page(button.dataset.soloBack));
    document.querySelectorAll('[data-make-own]').forEach(button=>button.onclick=makeOwn);
  });
  return {page,saved,launch,emptyScenario,entries,makeOwn};
})();
