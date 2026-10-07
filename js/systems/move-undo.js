// A single reversible movement, invalidated by subsequent gameplay changes.
const MoveUndo=(()=>{
 let entry=null;
 const copy=x=>JSON.parse(JSON.stringify(x));
 const signature=()=>JSON.stringify({units,settlements,resources,terrain,diplomacy,turnNumber,currentTeam,territory:typeof Territory!=='undefined'?Territory.snapshot():undefined,
   researchPoints:typeof researchPoints!=='undefined'?researchPoints:undefined,
   activeResearch:typeof activeResearch!=='undefined'?activeResearch:undefined,
   researchedTechs:typeof serializeResearch==='function'?serializeResearch():undefined,
   research:Object.fromEntries(Object.entries(researchedUnits).map(([t,s])=>[t,[...s]]))});
 function clear(){entry=null;}
 function begin(u){entry={id:u.id,team:currentTeam,turn:turnNumber,unit:copy(u),diplomacy:copy(diplomacy),territory:typeof Territory!=='undefined'?Territory.snapshot():undefined,settlements:copy(settlements),researchPoints:typeof researchPoints!=='undefined'?copy(researchPoints):undefined,researchPointReceipts:typeof researchPointReceipts!=='undefined'?copy(researchPointReceipts):undefined,messages:new Set(diplomacy.aiMessages||[])};}
 function finish(){if(typeof markScenarioPlaying==='function')markScenarioPlaying();if(entry){entry.after=signature();entry.captureMessages=(diplomacy.aiMessages||[]).filter(m=>!entry.messages.has(m)).map(m=>JSON.stringify(m));}}
 function canUndo(){
  if(!entry||gameOver||isEditorMode||currentTeam!==entry.team||turnNumber!==entry.turn)return false;
  // Capture rewards can refresh the UI before the movement snapshot is finished.
  if(!entry.after)return false;
  if(typeof OnlineMatch!=='undefined'&&!OnlineMatch.canAct())return false;
  if(signature()!==entry.after){clear();return false;}return true;
 }
 function undo(){
  if(!canUndo())return false;
  const e=entry,u=units.find(u=>u.id===e.id);if(!u)return false;
  clear();ActionEffects.move(u,e.unit.col,e.unit.row);Object.assign(u,e.unit);
  settlements=copy(e.settlements);
  if(typeof Territory!=='undefined')Territory.restore(e.territory);
  if(typeof restoreResearchPoints==='function')restoreResearchPoints(e.researchPoints,e.researchPointReceipts);
  diplomacy.aiMessages=(diplomacy.aiMessages||[]).filter(m=>!e.captureMessages.includes(JSON.stringify(m)));
  diplomacy.unreadMessages=diplomacy.aiMessages.filter(m=>!m.read).length;
  diplomacy=copy(e.diplomacy);if(typeof restoreDiplomacyConversations==='function')restoreDiplomacyConversations(true);
  selectedUnit=u;closeSpawnMenu();updateUI();postGameState();return true;
 }
 return {begin,finish,clear,canUndo,undo};
})();
