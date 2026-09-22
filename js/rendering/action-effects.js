// Visual events travel with accepted snapshots; IDs prevent echoed events from
// replaying on the acting client. Game coordinates remain authoritative.
const ActionEffects = (() => {
  let history = [], seen = new Set();
  const moves = new Map();
  function reset() { history=[];seen.clear();moves.clear();window.damagePopups=[]; }
  function valid(e) {
    const tile=p=>p&&Number.isInteger(p.col)&&Number.isInteger(p.row)&&p.col>=0&&p.col<COLS&&p.row>=0&&p.row<ROWS;
    return e&&typeof e.id==='string'&&e.id.length<100&&(
      e.type==='move'&&typeof e.unitId==='string'&&Array.isArray(e.path)&&e.path.length>=2&&e.path.length<=64&&e.path.every(tile)||
      e.type==='damage'&&tile(e)&&Number.isFinite(e.amount)&&e.amount>0);
  }
  function receive(events) {
    if(!Array.isArray(events))return;
    for(const e of events.slice(-64)) {
      if(!valid(e)||seen.has(e.id))continue;
      seen.add(e.id);history.push(e);history=history.slice(-64);
      if(e.type==='move') moves.set(e.unitId,{path:e.path,start:performance.now()});
      else {
        const p=getTileCenterLocal(e.col,e.row);
        (window.damagePopups ||= []).push({x:p.x,y:p.y-6,text:`-${e.amount}`,alpha:255,fade:6,dy:1.2,ttl:40});
      }
    }
  }
  function emit(event) { receive([{...event,id:crypto.randomUUID()}]); }
  function move(unit,col,row) {
    const path=findMovementPath(unit,col,row);
    if(path&&path.length>1)emit({type:'move',unitId:unit.id,path});
  }
  function position(unit, project, now=performance.now()) {
    const m=moves.get(unit.id);
    if(!m)return project(unit);
    const t=Math.max(0,(now-m.start)/150), i=Math.floor(t);
    if(i>=m.path.length-1){moves.delete(unit.id);return project(unit);}
    const a=project(m.path[i]),b=project(m.path[i+1]),f=t-i;
    return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
  }
  return {reset,receive,move,position,snapshot:()=>history.slice(),damage:(col,row,amount)=>emit({type:'damage',col,row,amount})};
})();
