// The board and inspection canvases share this renderer and its live unit state.
const UnitPresentation=(()=>{
 const variants=new Map();
 const rgba=(rgb,a=1)=>`rgba(${rgb.join(',')},${a})`;
 function sprite(u){
  const source=IMAGES[u.ruins?'Ruins':u.name]||IMAGES[u.name==='Fortress'?'Castle':''];
  if(!source?.width)return null;if(u.ruins)return source;
  // These elite silhouettes intentionally stay neutral. Their special effects
  // (Swordsman streaks, Assassin stealth, Dragon unrest/rogue state) are drawn
  // on the hex below the artwork, so their unit art remains identical for all
  // nations instead of acquiring nation-specific color shading.
  const neutralArt=['Swordsman','Assassin','Dragon'].includes(u.name);
  if(neutralArt)return source;
  const rgb=getTeamColor(u.team).fill,key=u.name+':'+rgb.join(',')+':'+source.src;
  if(variants.has(key))return variants.get(key);
  const c=document.createElement('canvas'),ratio=Math.min(1,384/Math.max(source.width,source.height));c.width=Math.max(1,Math.round(source.width*ratio));c.height=Math.max(1,Math.round(source.height*ratio));const ctx=c.getContext('2d');ctx.drawImage(source,0,0,c.width,c.height);
  // Recolor saturated cloth, shields and scales, preserving shading and neutral steel.
  // Warm skin/leather hues are retained on humanoids. Siege/ships receive a pennant.
  try{const data=ctx.getImageData(0,0,c.width,c.height),p=data.data;
   for(let i=0;i<p.length;i+=4){
    const [r,g,b]=[p[i],p[i+1],p[i+2]],hi=Math.max(r,g,b),lo=Math.min(r,g,b);
    if(!p[i+3])continue;
    // Fortress art reserves emerald hues for fabric: never tint masonry or wood.
    if(isFortressUnit(u)){
     if(g>r*1.2&&g>b*1.15&&g-Math.min(r,b)>18){
      const light=Math.min(1.35,.35+g/190);
      for(let n=0;n<3;n++)p[i+n]=Math.round(Math.min(255,rgb[n]*light));
     }
     continue;
    }
    const px=(i/4%c.width)/c.width,py=Math.floor(i/4/c.width)/c.height;
    const warm=r>g*1.12&&g>b*1.15;
    const robe=['Cleric','Crown'].includes(u.name)&&py>.3&&hi>65&&hi-lo<40;
    const assassin=u.name==='Assassin'&&px>.3&&px<.7&&py>.25&&py<.78&&hi<115;
    if(!robe&&!assassin&&(hi-lo<10||warm&&!['Dragon','Catapult'].includes(u.name)))continue;
    const shade=(hi+lo)/510,amount=robe?.75:assassin?.65:Math.min(.96,(hi-lo)/Math.max(1,hi)*3);
    for(let n=0;n<3;n++)p[i+n]=Math.round(p[i+n]*(1-amount)+Math.min(255,rgb[n]*(.5+shade*1.25))*amount);
   }ctx.putImageData(data,0,0);
  }catch(e){/* Custom cross-origin art still renders with a nation pennant. */}
  if(u.name==='Stockade'||u.isWaterUnit||u.name==='Catapult'){
   const x=c.width*.66,y=c.height*.15,w=c.width*.23,h=c.height*.13;
   ctx.strokeStyle='#c6b691';ctx.lineWidth=Math.max(2,c.width*.012);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+h*2);ctx.stroke();
   ctx.fillStyle=rgba(rgb);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y+h*.15);ctx.lineTo(x+w*.78,y+h);ctx.lineTo(x,y+h*.8);ctx.fill();
  }
  variants.set(key,c);return c;
 }
 function shape(ctx,x,y,r){ctx.beginPath();for(let i=0;i<6;i++){const a=Math.PI/3*i-Math.PI/6;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}
 function fit(ctx,img,x,y,w,h){if(!img?.width)return;const s=Math.min(w/img.width,h/img.height);ctx.drawImage(img,x-img.width*s/2,y-img.height*s/2,img.width*s,img.height*s);}
 function draw(ctx,u,x,y){
  const scale=getUnitRenderScale(),r=useHexGrid?HEX_SIZE*.82:TILE*.49;
  const broken=u.morale<=0&&!u.rogue,ready=!broken&&!u.ruins&&!u.rogue&&u.team===currentTeam&&(!u.hasMoved&&u.move>0||!u.hasActed&&(u.atkRange>0||u.name==='Cleric'));
  const flashing=!broken&&!u.ruins&&canUnitAttackFromCurrentPosition(u),pulse=flashing?.5+.5*Math.sin(frameCount*.18):0;
  let colors=getTeamColor(u.team),unrest=u.name==='Dragon'&&typeof Territory!=='undefined'?Territory.warning(u.team):0;
  if(u.ruins)colors={fill:[110,110,110],stroke:[190,190,190]};
  else if(u.rogue)colors={fill:[255,0,0],stroke:[255,40,40]};
  else if(unrest){const f=Math.min(1,unrest/3);colors={fill:colors.fill.map((v,i)=>v*(1-f)+(i===0?255:0)*f),stroke:[255,90,70]};}
  ctx.save();ctx.fillStyle=rgba(colors.fill,u.rogue?1:u.ruins?.8:flashing?.35+pulse*.45:.38);ctx.strokeStyle=rgba(colors.stroke,.85);ctx.lineWidth=2+pulse*2;ctx.setLineDash(ready?[5,4]:[]);shape(ctx,x,y,r);ctx.fill();ctx.stroke();ctx.setLineDash([]);
  if(!u.ruins&&u.name==='Swordsman'&&u.streakBonus>0){for(let i=0;i<3;i++){const t=((frameCount*.018+i/3)%1);ctx.strokeStyle=`rgba(255,45,40,${(1-t)*(.16+u.streakBonus*.6)})`;ctx.lineWidth=1+u.streakBonus*3;ctx.beginPath();ctx.ellipse(x,y,r*(.7+t*.65),r*(.55+t*.5),0,0,Math.PI*2);ctx.stroke();}}
  if(!u.ruins&&u.name==='Spearman'&&spearmanDefense(u)>.25){ctx.save();ctx.shadowColor='#ffe24c';ctx.shadowBlur=12;ctx.strokeStyle='#ffe24c';ctx.fillStyle='rgba(255,220,60,.16)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-r*.8,y-r*.65);ctx.lineTo(x,y-r*.85);ctx.lineTo(x+r*.8,y-r*.65);ctx.quadraticCurveTo(x+r*.8,y+r*.45,x,y+r*.9);ctx.quadraticCurveTo(x-r*.8,y+r*.45,x-r*.8,y-r*.65);ctx.fill();ctx.stroke();ctx.restore();}
  const img=sprite(u),bob=broken?0:getUnitMoveBobOffset(u),size=TILE*(isFortressUnit(u)?.9:.84)*scale;
  if(img)fit(ctx,img,x,y+bob,size,size);else{ctx.font=`${TILE*.38}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=rgba(colors.fill);ctx.fillText(({Sloop:'⛵','Man-of-War':'🚢',Battleship:'🛳️'})[u.name]||'⚔️',x,y+bob);}
  if(!u.ruins){
   const a=useHexGrid?getHexApothem():TILE/2;
   // Keep the status markers readable without letting them dominate the unit
   // silhouette. Both markers use the same 70% scale so their relative sizing
   // stays consistent across square and hex board layouts.
   const markerScale=.7;
   fit(ctx,INDICATOR_IMAGES[getRankIndicatorKey(u)],x-r*.5,y-a*.58,Math.min(30,r*.95)*markerScale,22*markerScale);
   fit(ctx,INDICATOR_IMAGES[getMoraleIndicatorKey(u)],x+r*.52,y-a*.58,Math.min(26,r*.7)*markerScale,26*markerScale);
   if(u.isWaterUnit){ctx.font=`${TILE*.2}px serif`;ctx.fillText('⚓',x+r*.5,y+r*.3);}
   const w=TILE*.6*scale,h=3*scale,by=y+r*.48,pct=Math.max(0,Math.min(1,u.hp/u.maxHp));ctx.fillStyle='#26312f';ctx.fillRect(x-w/2,by,w,h);ctx.fillStyle=pct>.5?'#22c55e':pct>.25?'#facc15':'#f43f5e';ctx.fillRect(x-w/2,by,w*pct,h);
  }ctx.restore();
 }
 function preview(u){return `<canvas class="unit-board-preview" width="260" height="230" data-unit-id="${String(u.id||'').replace(/[^\w-]/g,'')}" data-unit-type="${u.name}" data-unit-team="${u.team}" aria-label="${u.name} battlefield appearance"></canvas>`;}
 function refresh(){
  for(const canvas of document.querySelectorAll('.unit-board-preview')){
   if(!canvas.getClientRects().length)continue;
   const u=units.find(v=>v.id===canvas.dataset.unitId)||{...UNIT_TEMPLATES[canvas.dataset.unitType],name:canvas.dataset.unitType,team:canvas.dataset.unitTeam,hp:UNIT_TEMPLATES[canvas.dataset.unitType]?.hp,maxHp:UNIT_TEMPLATES[canvas.dataset.unitType]?.hp,morale:100,col:-100,row:-100,hasMoved:true,hasActed:true};
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(130,115);const s=170/(TILE*getUnitRenderScale());ctx.scale(s,s);draw(ctx,u,0,0);ctx.restore();
  }
 }
 return {draw,sprite,preview,refresh,variants};
})();
