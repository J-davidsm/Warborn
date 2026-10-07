// Compact command menus preserve the original controls and their event handlers.
const CommandMenu=(()=>{
 const $=id=>document.getElementById(id);let page=null;
 function close(){page=null;document.body.classList.remove('commands-open');$('commandToggle')?.setAttribute('aria-expanded','false');}
 function open(next='actions'){
  if(next==='editor'&&typeof WarbornLeaders!=='undefined')WarbornLeaders.editor();
  page=next;document.body.classList.add('commands-open');$('commandToggle').setAttribute('aria-expanded','true');
  document.querySelectorAll('.command-page').forEach(el=>el.hidden=el.dataset.page!==next);
  $('commandTitle').textContent={actions:'Commands',settings:'Battle settings',saves:'Saved battles',diplomacy:'Diplomacy',editor:'Editor tools'}[next];
  $('commandBack').hidden=next==='actions';$('commandClose').focus();
 }
 function refresh(){
  if(typeof Territory!=='undefined')Territory.render();
  if(!$('commandToggle'))return;
  const editorButton=$('editorModeBtn');
  const locked=typeof scenarioPlayStarted!=='undefined'&&scenarioPlayStarted&&!isEditorMode;
  if(editorButton){editorButton.disabled=locked;editorButton.title=locked?'Cannot edit while playing. You must restart the scenario to edit it':'';}
  if($('editorModeStatus'))$('editorModeStatus').hidden=!isEditorMode;

  if($('undoMoveBtn'))$('undoMoveBtn').disabled=!MoveUndo.canUndo();
  const visible=$('mainMenu')?.classList.contains('hidden')&&!gameOver;
  document.body.classList.toggle('commands-available',!!visible);
  if(!visible)close();
  const stack=$('battleStatusStack');if(stack){
   for(const id of ['resourceBanner','editorModeStatus','endlessBar','battleNotice','armyUpkeep'])if($(id)&&$(id).parentElement!==stack)stack.append($(id));
   const dock=$('turnActions'),bottom=dock?.getClientRects().length?dock.getBoundingClientRect().top:innerHeight;
   stack.style.maxHeight=Math.max(60,bottom-24)+'px';
  }
  if($('mapDiplomacyButton')&&$('turnActions')&&$('mapDiplomacyButton').parentElement!==$('turnActions'))$('turnActions').insertBefore($('mapDiplomacyButton'),$('endTurnBtn'));
  for(const id of ['buildWidget','waterUpgradeWidget'])if($(id)&&$('unitActions')&&$(id).parentElement!==$('unitActions'))$('unitActions').append($(id));
 }
 document.addEventListener('DOMContentLoaded',()=>{
  document.body.classList.add('compact-hud');
  const status=document.createElement('div');status.id='editorModeStatus';status.textContent='In Editor Mode';status.hidden=true;status.setAttribute('role','status');document.body.append(status);
  const panel=$('panel'),toolbar=$('battleToolbar');document.body.append(toolbar);
  toolbar.insertAdjacentHTML('afterbegin','<button id="commandToggle" aria-expanded="false" aria-controls="panel">☰ Commands</button>');
  const dock=document.createElement('div');dock.id='turnActions';const unitActions=document.createElement('div');unitActions.id='unitActions';dock.append(unitActions);dock.append($('endTurnBtn'));document.body.append(dock);
  const undo=document.createElement('button');undo.id='undoMoveBtn';undo.textContent='↶ Undo Move';undo.title='Undo your latest move before another action; restores captured settlements.';undo.disabled=true;undo.onclick=()=>MoveUndo.undo();dock.insertBefore(undo,unitActions);
  const stack=document.createElement('aside');stack.id='battleStatusStack';document.body.append(stack);
  document.body.append($('battleNotice'));if($('endlessBar'))document.body.append($('endlessBar'));
  const menu=document.createElement('div');menu.id='commandContents';menu.innerHTML='<header><button id="commandBack">← Back</button><h2 id="commandTitle">Commands</h2><button id="commandClose" aria-label="Close commands">×</button></header><div id="commandActions" class="command-page" data-page="actions"></div><div id="commandSettings" class="command-page" data-page="settings" hidden></div><div id="commandSaves" class="command-page" data-page="saves" hidden></div><div id="commandDiplomacy" class="command-page" data-page="diplomacy" hidden></div><div id="commandEditor" class="command-page" data-page="editor" hidden></div>';panel.append(menu);
  const move=(target,ids)=>ids.forEach(id=>{if($(id))$(target).append($(id));});
  move('commandActions',['editorModeBtn','restartBtn','battleMenuBtn']);
  for(const [label,next]of [['Battle settings','settings'],['Saved battles','saves'],['Relations & treaties','diplomacy'],['Editor tools','editor']]){const b=document.createElement('button');b.textContent=label;if(next==='editor')b.className='editor-only-command';b.onclick=()=>open(next);$('commandActions').append(b);}
  move('commandSettings',['aiPlayerControls','waitingBanner','connectionStatus']);
  move('commandSaves',['levelNameInput','saveLevelBtn','saveNamedLevelBtn','loadLevelBtn','savedLevelsPanel']);
  move('commandDiplomacy',['diplomacySection']);move('commandEditor',['editorControls','convertTeamsBtn']);
  $('commandToggle').onclick=()=>page?close():open();$('commandClose').onclick=close;$('commandBack').onclick=()=>open();
  $('editorModeBtn').addEventListener('click',()=>setTimeout(()=>{if(isEditorMode)open('editor');else close();},0));
  $('restartBtn').addEventListener('click',close);$('battleMenuBtn').addEventListener('click',close);
  for(const el of [panel,toolbar,dock])for(const event of ['pointerdown','pointerup','mousedown','mouseup','click','wheel','touchstart','touchend'])el.addEventListener(event,e=>e.stopPropagation());
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&page){close();$('commandToggle').focus();}});
  setInterval(refresh,500);refresh();
 });
 return {open,close,refresh,get blocking(){return !!page&&!isEditorMode;}};
})();
