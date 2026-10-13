// Run with: node_modules/.bin/electron scripts/test-tutorial.cjs
const {app,BrowserWindow}=require('electron'),fs=require('fs'),os=require('os'),path=require('path');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'acadania-tutorial-check-')));
app.whenReady().then(async()=>{
 const w=new BrowserWindow({show:false,width:1400,height:900,webPreferences:{backgroundThrottling:false}});
 w.webContents.on('dom-ready',async()=>{
  try{
   await new Promise(r=>setTimeout(r,3000));
   const result=await w.webContents.executeJavaScript(`(()=>{
    const check=(condition,message)=>{if(!condition)throw Error(message)};
    startIntroScenario(true);
    check(BattleGuide.blocking,'Briefing must pause actions');
    check(document.getElementById('guideProgress').textContent==='1 / 15','15 clear lessons');
    document.getElementById('guideSkip').click();
    check(!BattleGuide.blocking,'Practice must allow actions');
    check(!document.getElementById('practiceCoach').hidden,'Checklist visible');
    check(Number(getComputedStyle(document.getElementById('practiceCoach')).zIndex)>2000,'Checklist is above game canvas');
    check(document.getElementById('practiceTitle').textContent.includes('Heal'),'Healing first');
    const healer=units.find(u=>u.name==='Cleric'),wounded=units.find(u=>u.hp<u.maxHp);
    BattleGuide.inspect(wounded.col,wounded.row);
    check(document.getElementById('practiceTitle').textContent.includes('Heal'),'Inspection cannot complete healing');
    healUnit(healer,wounded);
    check(document.getElementById('practiceTitle').textContent.includes('Capture the neutral'),'Successful healing advances');
    const soldier=getUnitAt(2,5);check(canMoveTo(soldier,4,4),'First capture is reachable');
    completeHumanMove(soldier,4,4);BattleGuide.refresh();
    check(document.getElementById('practiceTitle').textContent.includes('Collect'),'Capture advances');
    openSpawnMenu(2,5,settlements[5*COLS+2]);BattleGuide.refresh();
    check(document.getElementById('practiceCoach').hidden,'Checklist must hide behind settlement menu');
    closeSpawnMenu();BattleGuide.refresh();check(!document.getElementById('practiceCoach').hidden,'Checklist returns');
    document.getElementById('practiceSkip').click();check(document.getElementById('practiceTitle').textContent.includes('Buy'),'Skip advances');
    resources.PLAYER.gold=5;lastActionTime=0;
    spawnUnitAt('Soldier','PLAYER',2,5);BattleGuide.refresh();
    check(document.getElementById('practiceTitle').textContent.includes('Start one doctrine'),'Recruitment advances');
    check(startDoctrineResearch('PLAYER','field_training'),'Study available doctrine');
    check(document.getElementById('practiceTitle').textContent.includes('Training Outpost'),'Research advances to objective');
    document.getElementById('practiceClose').click();check(document.getElementById('practiceCoach').hidden,'Hide works');
    startIntroScenario(true);document.getElementById('guideSkip').click();
    check(document.getElementById('practiceTitle').textContent.includes('Heal'),'Restart begins fresh');
    startIntroScenario(false);check(document.getElementById('practiceCoach').hidden,'No leakage into skirmish');
    startIntroScenario(true);
    return {lessons:BattleGuide.lessons().length,passed:true};
   })()`);
   console.log(JSON.stringify(result));app.exit(0);
  }catch(e){console.error(e);app.exit(1);}
 });
 w.loadFile(path.join(__dirname,'..','index.html'));
});
setTimeout(()=>app.exit(2),55000);
