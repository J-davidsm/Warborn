// A single reversible movement, invalidated by subsequent gameplay changes.
const MoveUndo=(()=>{
 let entry=null;
 const copy=x=>JSON.parse(JSON.stringify(x));
 const signature=()=>JSON.stringify({units,settlements,resources,terrain,turnNumber,currentTeam,
   research:Object.fromEntries(Object.entries(researchedUnits).map(([t,s])=>[t,[...s]]))});
 function clear(){entry=null;}
 function begin(u){entry={id:u.id,team:currentTeam,turn:turnNumber,unit:copy(u),settlements:copy(settlements),messages:new Set(diplomacy.aiMessages||[])};}
 function finish(){if(entry){entry.after=signature();entry.captureMessages=(diplomacy.aiMessages||[]).filter(m=>!entry.messages.has(m)).map(m=>JSON.stringify(m));}}
 function canUndo(){
  if(!entry||gameOver||isEditorMode||currentTeam!==entry.team||turnNumber!==entry.turn)return false;
  if(typeof OnlineMatch!=='undefined'&&!OnlineMatch.canAct())return false;
  if(signature()!==entry.after){clear();return false;}return true;
 }
 function undo(){
  if(!canUndo())return false;
  const e=entry,u=units.find(u=>u.id===e.id);if(!u)return false;
  clear();ActionEffects.move(u,e.unit.col,e.unit.row);Object.assign(u,e.unit);
  settlements=copy(e.settlements);
  diplomacy.aiMessages=(diplomacy.aiMessages||[]).filter(m=>!e.captureMessages.includes(JSON.stringify(m)));
  diplomacy.unreadMessages=diplomacy.aiMessages.filter(m=>!m.read).length;
  selectedUnit=u;closeSpawnMenu();updateUI();postGameState();return true;
 }
 return {begin,finish,clear,canUndo,undo};
})();
