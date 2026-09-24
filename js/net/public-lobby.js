/* Live visitor directory. A browser holds a rendezvous ID; another takes over
   if it leaves. PeerJS Cloud brokers connections; no names are stored on GitHub. */
const PublicLobby=(()=>{
 const ROOT='warborn-j-davidsm-public-v2'+(new URL(location.href).hostname==='j-davidsm.github.io'?'':'-preview'),$=id=>document.getElementById(id);
 let peer=null,upstream=null,leader=false,online=false,retry=null,epoch=0,rows=[],records=new Map(),links=new Map();
 let lastSent='',inviteAt=0;
 const name=()=>$('lobbyName').value.trim().slice(0,24)||'Commander';
 const mine=()=>({id:peer?.id,name:name(),...OnlineMatch.publicInfo});
 const tx=(c,m)=>{if(c?.open)c.send({...m,directory:2});};
 function paint(){
  const list=$('publicPlayers');if(!list)return;list.replaceChildren();
  $('publicStatus').textContent=online?rows.length+' commander'+(rows.length===1?'':'s')+' online':'Connecting to the public lobby… Room codes remain available.';
  for(const r of rows){
   const li=document.createElement('li'),text=document.createElement('span');
   text.textContent=r.name+(r.id===peer?.id?' (you)':'')+' · '+r.where+(r.room?' · '+r.count+'/'+r.capacity:'');li.append(text);
   if(r.id!==peer?.id&&!OnlineMatch.active){
    let button=document.createElement('button');button.className='small';
    if(r.room&&!r.playing&&r.count<r.capacity){button.textContent='Join';button.onclick=()=>OnlineMatch.join(r.room);}
    else if(!r.room){button.textContent='Invite';button.onclick=()=>OnlineMatch.invite(r.id);}
    else button=null;
    if(button)li.append(button);
   }
   list.append(li);
  }
 }
 function broadcast(){
  rows=[...records.values()].map(r=>r.data);for(const c of links.values())tx(c,{type:'list',rows});paint();
 }
 function clean(record,id){
  if(!record||typeof record.name!=='string')return null;
  const info={id,name:record.name.slice(0,24)||'Commander',where:['Browsing','In lobby','In a room','In battle'].includes(record.where)?record.where:'Browsing',
   room:/^[A-HJ-NP-Z2-9]{8}$/.test(record.room)?record.room:'',host:!!record.host,count:Math.max(0,Math.min(4,Number(record.count)||0)),capacity:[2,3,4].includes(record.capacity)?record.capacity:2,playing:!!record.playing};
  return info;
 }
 function update(force=false){
  if(!online||!peer)return;
  const record=mine(),encoded=JSON.stringify(record);
  if(!force&&lastSent===encoded){paint();return;}
  lastSent=encoded;
  if(leader){records.set(peer.id,{data:record,seen:Date.now()});broadcast();}
  else tx(upstream,{type:'presence',record});
 }
 function invitation(m){
  if(typeof m.name!=='string'||!/^[A-HJ-NP-Z2-9]{8}$/.test(m.room)||OnlineMatch.active)return;
  const box=$('publicInvite');box.replaceChildren();box.hidden=false;
  const text=document.createElement('span');text.textContent=m.name.slice(0,24)+' invited you to a match. ';
  const button=document.createElement('button');button.textContent='Join invitation';button.onclick=()=>{box.hidden=true;OnlineMatch.join(m.room);};
  const dismiss=document.createElement('button');dismiss.textContent='Dismiss';dismiss.onclick=()=>{box.hidden=true;};
  box.append(text,button,dismiss);
  // Reveal an invitation without interrupting an ongoing single-player game.
  $('menuOnlineBtn').textContent='Multiplayer · Invitation';
 }
 function routeInvite(from,m){
  const sender=records.get(from)?.data;
  if(!sender||!sender.host||sender.room!==m.room||sender.playing||sender.count>=sender.capacity)return;
  const packet={type:'invite',name:sender.name,room:sender.room};
  if(m.target===peer.id)invitation(packet);else tx(links.get(m.target),packet);
 }
 function invite(target,room){
  if(!online||Date.now()-inviteAt<1500)return;inviteAt=Date.now();update(true);
  const m={type:'invite',target,room};if(leader)routeInvite(peer.id,m);else tx(upstream,m);
 }
 function schedule(){
  if(retry)return;online=false;rows=[];paint();
  retry=setTimeout(()=>{retry=null;elect();},1200+Math.random()*2000);
 }
 function elect(){
  epoch++;const n=epoch;const old=peer;peer=null;old?.destroy();leader=false;online=false;records.clear();links.clear();upstream=null;lastSent='';
  if(typeof Peer==='undefined'){$('publicStatus').textContent='Connection service unavailable. Refresh to retry.';return;}
  const p=new Peer(ROOT,{secure:true,debug:0});peer=p;
  p.on('open',()=>{if(epoch!==n)return;leader=true;online=true;update(true);});
  p.on('connection',c=>{
   if(epoch!==n||!leader)return c.close();links.set(c.peer,c);
   c.on('data',m=>{
    if(epoch!==n||m?.directory!==2)return;
    if(m.type==='presence'){const data=clean(m.record,c.peer);if(data){records.set(c.peer,{data,seen:Date.now()});broadcast();}}
    if(m.type==='invite')routeInvite(c.peer,m);
   });
   c.on('close',()=>{if(epoch!==n||links.get(c.peer)!==c)return;links.delete(c.peer);records.delete(c.peer);broadcast();});
   c.on('error',()=>c.close());
  });
  p.on('error',e=>{if(epoch!==n||peer!==p)return;if(e.type==='unavailable-id')follow(n);else schedule();});
  p.on('disconnected',()=>{if(epoch===n&&peer===p)schedule();});
 }
 function follow(n){
  const old=peer;peer=null;old?.destroy();const p=new Peer(undefined,{secure:true,debug:0});peer=p;
  p.on('open',()=>{
   if(epoch!==n)return;
   const c=p.connect(ROOT,{reliable:true,serialization:'json'});upstream=c;
   c.on('open',()=>{if(epoch===n){online=true;update(true);}});
   c.on('data',m=>{
    if(epoch!==n||m?.directory!==2)return;
    if(m.type==='list'&&Array.isArray(m.rows)){rows=m.rows.slice(0,500).map(r=>clean(r,r.id)).filter(Boolean);online=true;paint();}
    if(m.type==='invite')invitation(m);
   });
   c.on('close',()=>{if(epoch===n)schedule();});c.on('error',()=>{if(epoch===n)schedule();});
   setTimeout(()=>{if(epoch===n&&!c.open)schedule();},15000);
  });
  p.on('error',()=>{if(epoch===n)schedule();});p.on('disconnected',()=>{if(epoch===n)schedule();});
 }
 document.addEventListener('DOMContentLoaded',()=>{
  if($('lobbyName').value==='Commander')$('lobbyName').value='Commander '+Math.floor(1000+Math.random()*9000);
  elect();setInterval(()=>{
   if(leader){for(const [id,r]of records)if(id!==peer.id&&Date.now()-r.seen>65000){links.get(id)?.close();links.delete(id);records.delete(id);}}
   update(true);
  },20000);
 });
 window.addEventListener('beforeunload',()=>{epoch++;clearTimeout(retry);peer?.destroy();});
 return {update,invite};
})();
