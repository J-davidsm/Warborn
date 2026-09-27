const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let menu=false;const c={console,Math,width:1280,height:720,zoomLevel:1,targetZoom:1,panX:0,panY:0,targetPanX:0,targetPanY:0,minZoom:.3,maxZoom:8,constrain:(v,a,b)=>Math.max(a,Math.min(b,v)),document:{querySelector:()=>({getBoundingClientRect:()=>({left:0})}),getElementById:id=>id==='panel'?{getBoundingClientRect:()=>({left:892})}:id==='spawnMenu'&&menu?{}:null},getMapOrigin:()=>({x:190,y:-90}),getMapWorldBounds:()=>({x:0,y:0,width:900,height:900})};vm.createContext(c);vm.runInContext(fs.readFileSync('js/rendering/renderer.js','utf8'),c);
c.setZoom(.001);assert.equal(c.targetZoom,.6,'cannot zoom past complete-map fit');
c.setZoom(2,600,350);c.panCamera(-99999,0);c.panX=c.targetPanX;let edge=c.worldToScreen(900,450);assert.equal(edge.x,868,'right map edge reaches exposed viewport, not behind sidebar');c.panX=c.targetPanX;
c.panCamera(99999,0);c.panX=c.targetPanX;assert.equal(c.worldToScreen(0,450).x,24,'left edge remains accessible');
c.zoomLevel=c.targetZoom=2;c.panX=c.targetPanX=-600;c.panY=c.targetPanY=-600;const before=c.screenToWorld(640,360);c.setZoom(2.4,640,360);const after=c.screenToWorld(640,360);assert(Math.abs(before.x-after.x)<1e-8);assert(Math.abs(before.y-after.y)<1e-8);
menu=true;const old=c.targetZoom;c.setZoom(4,640,360);assert.equal(c.targetZoom,old,'settlement menu locks zoom');
console.log('Camera fit floor, cursor anchoring, left/right bounds and settlement zoom lock pass.');

c.CommandMenu={};assert.equal(c.getBattleViewport().right,1256,'compact HUD frees the complete map width');
