const fs=require('fs');
const vm=require('vm');
const assert=require('assert/strict');

const stored=new Map([['warborn.musicMuted','true']]);
const handlers={};
const attrs={};
const button={textContent:'',title:'',setAttribute:(key,value)=>{attrs[key]=value},addEventListener:(name,fn)=>{(handlers[name] ||= []).push(fn)}};
const tracks=[];
let audioContext;
class FakeAudio {
  constructor(src){this.src=src;this.paused=true;this.playCount=0;this.pauseCount=0;tracks.push(this)}
  load(){}
  play(){this.paused=false;this.playCount++;return Promise.resolve()}
  pause(){this.paused=true;this.pauseCount++}
}
class FakeGain {
  constructor(){this.gain={value:1}}
  connect(){return this}
}
class FakeSource {
  constructor(){this.buffer=null}
  connect(){return this}
  start(){audioContext.sourceStarts++}
}
class FakeAudioContext {
  constructor(){audioContext=this;this.state='running';this.destination={};this.sourceStarts=0;this.masterGain=null}
  createGain(){const gain=new FakeGain();if(!this.masterGain)this.masterGain=gain;return gain}
  createBuffer(){return {getChannelData:()=>({set(){}})}}
  createBufferSource(){return new FakeSource()}
  resume(){return Promise.resolve()}
}
const sandbox={
  console,Audio:FakeAudio,Math,Date,Float32Array,
  localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},
  document:{readyState:'complete',getElementById:id=>id==='musicToggleBtn'?button:null},
  window:{AudioContext:FakeAudioContext,addEventListener(){}}
};
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../js/audio/soundManager.js'),'utf8'),sandbox);
const sound=sandbox.window.SoundManager;
const music=tracks[0];
assert.equal(music.src,'assets/audio/oppressive-gloom.mp3');
assert.equal(music.loop,true);
function clickButton(){
  const event={propagationStopped:false,stopPropagation(){this.propagationStopped=true}};
  for(const handler of handlers.click)handler(event);
  return event;
}

assert.equal(sound.isMusicMuted(),true);
assert.equal(button.textContent,'♫ Music Off');
assert.equal(attrs['aria-pressed'],'true');
sound.startBackgroundMusic();
assert.equal(music.playCount,0,'muted music must not start');
clickButton();
assert.equal(sound.isMusicMuted(),false);
assert.equal(stored.get('warborn.musicMuted'),'false');
assert.equal(button.textContent,'♫ Music On');
assert.equal(music.playCount,1,'unmuting resumes music previously requested by the game');
sound.playMove();
assert.equal(audioContext.sourceStarts,1,'sound effects play while audio is enabled');
clickButton();
assert.equal(music.paused,true,'muting pauses the current track');
assert.equal(attrs['aria-pressed'],'true');
assert.equal(audioContext.masterGain.gain.value,0,'muting silences effects already playing');
sound.playMove();
assert.equal(audioContext.sourceStarts,1,'muting prevents new sound effects');
clickButton();
assert.equal(audioContext.masterGain.gain.value,.72,'unmuting restores the effects mix');
sound.playMove();
assert.equal(audioContext.sourceStarts,2,'effects resume after unmuting');
for(const name of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend']){
  const event={propagationStopped:false,stopPropagation(){this.propagationStopped=true}};
  handlers[name][0](event);
  assert.equal(event.propagationStopped,true,`${name} should not leak into game controls`);
}
console.log('Music mute persists, pauses playback, and resumes when turned back on.');

// Startup owns one complete music download, without an initial media-range load.
let mediaLoads=0,downloads=0;
const startup={...sandbox,StartupAssets:{},location:{protocol:'https:'},AbortController,setTimeout,clearTimeout,
 Audio:class extends FakeAudio{load(){mediaLoads++;}},
 URL:{createObjectURL:()=> 'blob:preloaded-music'},
 fetch:async()=>{downloads++;return {ok:true,blob:async()=>({})};},
 window:{addEventListener(){}}
};
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../js/audio/soundManager.js'),'utf8'),startup);
assert.equal(mediaLoads,0,'No duplicate media request before startup fetch');
const ready=startup.window.SoundManager.prepareMusic();
assert.equal(startup.window.SoundManager.prepareMusic(),ready,'Concurrent callers share the download');
ready.then(()=>{
 assert.equal(downloads,1);assert.equal(mediaLoads,1);assert.equal(tracks.at(-1).src,'blob:preloaded-music');
 console.log('Startup downloads music once and reuses the complete local blob.');
}).catch(error=>{console.error(error);process.exitCode=1;});
