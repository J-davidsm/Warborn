// Warm the same URLs used by the board and menus before the player can begin.
// Keep this separate from p5 setup: loading errors can be retried without resetting a game.
const StartupAssets=(()=>{
 const $=id=>document.getElementById(id);
 let loaded=false,setupDone=false,running=false;
 const completed=new Set(),retained=[];
 function images(){
  const urls=[...Object.values(DEFAULT_IMAGE_MAP),...Object.values(SETTLEMENT_IMAGE_MAP),...Object.values(FACTION_FLAG_MAP),...Object.values(INDICATOR_IMAGE_MAP)];
  for(const type of TERRAIN_V2_TYPES.filter(t=>t!=='BRIDGE'))for(let i=1;i<=6;i++)urls.push(`assets/terrain/v2/${type.toLowerCase()}-${i}.jpg${['WOODS','SWAMP'].includes(type)?'?v=training1':''}`);
  urls.push('assets/terrain/v3/bridge-stone.png','assets/terrain/v3/bridge-timber.png');
  for(const [id] of WarbornLeaders.choices)urls.push(`assets/leaders/${id}.webp`);
  urls.push('assets/leaders/player-crown.webp');
  for(const branch of ['warfare','command','defense','engineering'])for(const suffix of ['-background.webp','-button.webp','.svg'])urls.push(`assets/doctrines/${branch}${suffix}`);
  for(const name of ['anchor-button','fortress-button','turn-banner','menu-painted','button-banner','captain-garran'])urls.push(`assets/ui/${name}.webp`);
  urls.push('assets/menu.jpg','assets/victory.jpg','assets/defeat.jpg');
  return [...new Set(urls)];
 }
 function loadImage(url){
  return new Promise((resolve,reject)=>{
   const img=new Image();let settled=false;
   const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);img.onload=img.onerror=null;error?reject(error):resolve();};
   const timer=setTimeout(()=>finish(new Error('Image load timed out: '+url)),45000);
   img.onerror=()=>finish(new Error('Image unavailable: '+url));
   img.onload=async()=>{try{if(img.decode)await img.decode();
    // Retain menu artwork so opening a doctrine/diplomacy page doesn't decode it again.
    if(/assets\/(doctrines|leaders|ui)\//.test(url))retained.push(img);
    finish();}catch(error){finish(error);}};
   img.src=url;
  });
 }
 function finish(){
  if(!loaded||!setupDone)return;
  $('startupLoading').hidden=true;document.body.classList.remove('assets-loading');
  if(!window.warbornReady){window.warbornReady=true;document.dispatchEvent(new Event('warborn:ready'));}
 }
 async function start(){
  if(running)return;running=true;
  // Start the large audio transfer immediately instead of after every image.
  const jobs=[['music',()=>SoundManager.prepareMusic()],...images().map(url=>[url,()=>loadImage(url)])];
  const failed=[];let next=0;
  $('startupRetry').hidden=true;$('startupContinue').hidden=true;
  const progress=()=>{$('startupProgress').max=jobs.length;$('startupProgress').value=completed.size;$('startupStatus').textContent=`Loading artwork and audio… ${completed.size} / ${jobs.length}`;};
  progress();
  // Bound concurrent downloads on slower connections; existing board preloads share the browser cache.
  await Promise.all(Array.from({length:6},async()=>{
   while(next<jobs.length){const [id,load]=jobs[next++];if(completed.has(id))continue;
    try{await load();completed.add(id);}catch(error){failed.push(id);console.warn('Startup asset failed',id,error);}progress();
   }
  }));
  running=false;
  if(failed.length){
   $('startupStatus').textContent=`${failed.length} asset${failed.length===1?'':'s'} could not load. Retry, or continue with available artwork.`;
   $('startupRetry').hidden=false;$('startupContinue').hidden=false;
  }else{loaded=true;$('startupStatus').textContent='Ready';finish();}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  $('startupRetry').onclick=start;$('startupContinue').onclick=()=>{loaded=true;finish();};start();
 },{once:true});
 // Do not let menu shortcuts start a game behind the loading screen.
 window.addEventListener('keydown',event=>{if(!loaded&&!event.target.closest('#startupLoading')){event.preventDefault();event.stopImmediatePropagation();}},true);
 return {images,start,get ready(){return loaded&&setupDone;},setupComplete(){setupDone=true;finish();}};
})();
