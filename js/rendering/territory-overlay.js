// Merge shared polygon edges per kingdom, leaving only each territory's perimeter.
// Geometry is cached until ownership, map layout, or camera coordinates change.
const TerritoryOverlay=(()=>{
 let cachedOwners=null,cachedLayout='',cached=null;
 function geometry(owners,cols,rows,hex,size,tile,cameraCol=0,cameraRow=0){
  const cells=[],edges=new Map();
  const pointKey=p=>`${Math.round(p.x*10000)},${Math.round(p.y*10000)}`;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const team=owners[row*cols+col];if(!team)continue;
   const c=col-cameraCol,r=row-cameraRow;
   const center=hex?{x:size*1.5*c,y:size*Math.sqrt(3)*(r+.5*(c&1))}:{x:(c+.5)*tile,y:(r+.5)*tile};
   const points=hex?Array.from({length:6},(_,i)=>({x:center.x+size*Math.cos(i*Math.PI/3),y:center.y+size*Math.sin(i*Math.PI/3)})):
    [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y])=>({x:center.x+x*tile,y:center.y+y*tile}));
   cells.push({team,points});
   points.forEach((a,i)=>{const b=points[(i+1)%points.length],key=team+':'+[pointKey(a),pointKey(b)].sort().join(':');
    if(edges.has(key))edges.delete(key);else edges.set(key,{team,a,b,center});
   });
  }
  return {cells,edges:[...edges.values()]};
 }
 function draw(){
  if(typeof Territory==='undefined'||!Array.isArray(terrain))return;
  const owners=Territory.ownership(),layout=[COLS,ROWS,useHexGrid,HEX_SIZE,TILE,cameraX,cameraY].join(':');
  if(owners!==cachedOwners||layout!==cachedLayout){cached=geometry(owners,COLS,ROWS,useHexGrid,HEX_SIZE,TILE,cameraX,cameraY);cachedOwners=owners;cachedLayout=layout;}
  push();noStroke();
  for(const cell of cached.cells){const rgb=getTeamColor(cell.team).fill;fill(...rgb,36);beginShape();for(const p of cell.points)vertex(p.x,p.y);endShape(CLOSE);}
  // A small inset keeps both kingdoms' colors visible along a contested border.
  strokeWeight(2/Math.max(.3,zoomLevel));
  for(const e of cached.edges){const rgb=getTeamColor(e.team).fill;stroke(...rgb,255);
   const dx=e.center.x-(e.a.x+e.b.x)/2,dy=e.center.y-(e.a.y+e.b.y)/2,d=Math.hypot(dx,dy),inset=.8/Math.max(.3,zoomLevel);
   line(e.a.x+dx/d*inset,e.a.y+dy/d*inset,e.b.x+dx/d*inset,e.b.y+dy/d*inset);
  }
  pop();
 }
 return {geometry,draw};
})();
