// Stable portrait IDs live in scenario diplomacy state; internal team IDs never change.
const WarbornLeaders=(()=>{
 const choices=[['aldric','King Aldric Ironvale'],['brennan','Duke Brennan Stormhold'],['cassian','Lord Cassian Blackthorn'],['dorian','Marshal Dorian Ashfall'],['edric','Prince Edric Silvermere'],['farid','Sultan Farid Sunspire'],['garrick','King Garrick Frostbane'],['hadrian','Archduke Hadrian Ravenscar']];
 function get(team){const id=diplomacy?.leaders?.[team];return choices.find(c=>c[0]===id)||choices[Math.max(0,aiTeamNames.indexOf(team))%choices.length];}
 function acceptPeace(team){
  if(currentTeam!=='PLAYER'||!isAtWar(team,'PLAYER')||!(diplomacy.peaceBeggingFlags?.[team]>=turnNumber))return false;
  createTreaty('PLAYER',team,'NON_AGGRESSION',20);addAIMessage(team,'Peace is agreed. Our non-aggression pact is now in force.','PEACE_RESPONSE');updateDiplomacyTarget();updateUI();postGameState();return true;
 }
 function render(){
  if(typeof document==='undefined'||!currentDiplomacyTarget)return;
  const host=document.getElementById('diplomacyTargetInfo');if(!host)return;
  document.getElementById('leaderPortrait')?.remove();document.getElementById('peaceProposal')?.remove();
  const [id,name]=get(currentDiplomacyTarget),img=document.createElement('img');img.id='leaderPortrait';img.src=`assets/leaders/${id}.webp`;img.alt=name;host.prepend(img);
  if(diplomacy.peaceBeggingFlags?.[currentDiplomacyTarget]>=turnNumber&&isAtWar(currentDiplomacyTarget,'PLAYER')){
   const team=currentDiplomacyTarget,box=document.createElement('div');box.id='peaceProposal';box.textContent='Peace proposal: 20-turn non-aggression pact. ';
   const b=document.createElement('button');b.textContent='Accept peace';b.disabled=currentTeam!=='PLAYER';b.onclick=()=>acceptPeace(team);box.appendChild(b);host.appendChild(box);
   const decline=document.createElement('button');decline.textContent='Decline';decline.disabled=currentTeam!=='PLAYER';decline.onclick=()=>{delete diplomacy.peaceBeggingFlags[team];render();postGameState();};box.appendChild(decline);
  }
 }
 function editor(){
  const host=document.getElementById('editorControls');if(!host)return;
  document.getElementById('leaderChoices')?.remove();const section=document.createElement('section');section.id='leaderChoices';
  for(const team of getActiveTeams().filter(isAITeam)){
   const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=get(team)[1];field.appendChild(legend);
   for(const [id,name] of choices){const b=document.createElement('button');b.type='button';b.className='leader-choice'+(get(team)[0]===id?' chosen':'');b.title=name;b.setAttribute('aria-label',name);b.disabled=!isEditorMode||scenarioPlayStarted;
    const img=document.createElement('img');img.src=`assets/leaders/${id}.webp`;img.alt=name;b.appendChild(img);b.onclick=()=>{if(!isEditorMode||scenarioPlayStarted)return;(diplomacy.leaders||={})[team]=id;editor();if(typeof updateTeamSelector==='function')updateTeamSelector();};field.appendChild(b);
   }section.appendChild(field);
  }host.appendChild(section);
 }
 return {choices,get,render,editor,acceptPeace};
})();
