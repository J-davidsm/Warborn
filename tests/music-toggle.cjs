const fs=require('fs');
const vm=require('vm');
const assert=require('assert/strict');

const stored=new Map([['warborn.musicMuted','true']]);
const handlers={};
const attrs={};
const button={textContent:'',title:'',setAttribute:(key,value)=>{attrs[key]=value},addEventListener:(name,fn)=>{(handlers[name] ||= []).push(fn)}};
const tracks=[];
class FakeAudio {
  constructor(src){this.src=src;this.paused=true;this.playCount=0;this.pauseCount=0;tracks.push(this)}
  load(){}
  play(){this.paused=false;this.playCount++;return Promise.resolve()}
  pause(){this.paused=true;this.pauseCount++}
}
const sandbox={
  console,Audio:FakeAudio,Math,Date,Float32Array,
  localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},
  document:{readyState:'complete',getElementById:id=>id==='musicToggleBtn'?button:null},
  window:{AudioContext:null,addEventListener(){}}
};
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../js/audio/soundManager.js'),'utf8'),sandbox);
const sound=sandbox.window.SoundManager;
const music=tracks[0];
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
clickButton();
assert.equal(music.paused,true,'muting pauses the current track');
assert.equal(attrs['aria-pressed'],'true');
for(const name of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend']){
  const event={propagationStopped:false,stopPropagation(){this.propagationStopped=true}};
  handlers[name][0](event);
  assert.equal(event.propagationStopped,true,`${name} should not leak into game controls`);
}
console.log('Music mute persists, pauses playback, and resumes when turned back on.');
