// PLAYWRIGHT_MODULE=/path/to/playwright node scripts/test-web-release.cjs chromium
const {chromium,firefox,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const engine=process.argv[2]||'chromium',slow=process.argv.includes('--slow');
(async()=>{
 const chromiumEngine=['chromium','chrome','msedge'].includes(engine);
 const browser=await (chromiumEngine?chromium:({firefox,webkit})[engine]).launch({headless:true,...(chromiumEngine?{channel:engine}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('127.0.0.1:887')&&r.status()>=400)missing.push(r.url()+':'+r.status());});
 if(chromiumEngine)await context.grantPermissions(['local-network-access']);
 await page.route('http://127.0.0.1:8877/portal-test.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body{margin:0;height:100%;background:#10151b}iframe{border:0;width:100%;height:100%}</style><iframe allow="autoplay; fullscreen; clipboard-write; local-network-access *; local-network *; loopback-network *" src="http://127.0.0.1:'+(slow?'8879':'8878')+'/index.html"></iframe>'}));

 const begin=Date.now();await page.goto('http://127.0.0.1:8877/portal-test.html',{waitUntil:'domcontentloaded',timeout:180000});
 console.log('Parent loaded',engine);
 page.on('requestfailed',r=>console.log('Request failed',r.url(),r.failure()?.errorText));
 await page.waitForFunction(()=>document.querySelector('iframe')!==null);
 let frame;for(let attempt=0;attempt<600;attempt++){frame=page.frames().find(f=>f!==page.mainFrame()&&f.url().includes('127.0.0.1'));if(frame)break;await page.waitForTimeout(100);}if(!frame)throw Error('Game frame did not navigate');
 await frame.waitForFunction(()=>window.warbornReady===true,{},{timeout:180000});
 const startupMs=Date.now()-begin;console.log('Startup ready',engine,startupMs);
 fs.mkdirSync('release/screenshots',{recursive:true});
 await page.screenshot({path:`release/screenshots/${engine}-menu.png`});
 const check=await frame.evaluate(()=>{
  const check=(x,m)=>{if(!x)throw Error(m)};
  startIntroScenario(true);check(BattleGuide.blocking,'Tutorial opens');
  check(BattleGuide.lessons().length===15,'Tutorial lessons');document.getElementById('guideNext').click();
  check(document.getElementById('guideProgress').textContent==='2 / 15','Next lesson');
  document.getElementById('guidePrevious').click();check(document.getElementById('guideProgress').textContent==='1 / 15','Previous lesson');
  document.getElementById('guideSkip').click();check(!document.getElementById('practiceCoach').hidden,'Practice coach');
  resources.PLAYER.gold=17;saveScenario();resources.PLAYER.gold=1;loadLevel();check(resources.PLAYER.gold===17,'Save/load economy');
  const city=settlements.findIndex(s=>s?.owner==='PLAYER');openSpawnMenu(city%COLS,Math.floor(city/COLS),settlements[city],'research');
  document.querySelectorAll('#tabContent button').forEach(b=>{if(b.textContent==='Command')b.click()});
  restoreResearchPoints({PLAYER:10});researchTech('PLAYER','field_training');
  check(hasTech('PLAYER','field_training'),'Research purchased');closeSpawnMenu();
  SoundManager.setMusicMuted(true);check(SoundManager.isMusicMuted(),'Mute');SoundManager.setMusicMuted(false);check(!SoundManager.isMusicMuted(),'Unmute');SoundManager.setMusicMuted(true);
  check(PortalLinks.inviteURL('ABCD2345')==='https://j-davidsm.github.io/Warborn/?room=ABCD2345','Embedded invite');
  return {tutorial:true,saveLoad:true,research:true,audioToggle:true,portalInvite:true};
 });
 await page.screenshot({path:`release/screenshots/${engine}-battle.png`});
 for(const [width,height] of [[1024,768],[1920,1080]]){await page.setViewportSize({width,height});await page.waitForTimeout(300);assert(await frame.evaluate(()=>!!document.querySelector('canvas')&&document.querySelector('canvas').width>0),'Canvas after resize');}
 await frame.evaluate(()=>{const i=settlements.findIndex(s=>s?.owner==='PLAYER');openSpawnMenu(i%COLS,Math.floor(i/COLS),settlements[i],'research');});
 await page.screenshot({path:`release/screenshots/${engine}-research.png`});
 const result={engine,version:browser.version(),slow,network:slow?'10 Mbps shared server bandwidth / 100 ms request latency, fresh browser context':'local HTTP',startupMs,checks:check,errors,missing};
 fs.writeFileSync(`release/${engine}${slow?'-slow':''}-results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 await browser.close();assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
})().catch(e=>{console.error(e);process.exit(1)});
