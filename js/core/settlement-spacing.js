// Placement rule shared by every editor scenario. Existing saved layouts load intact.
(function(root){
  function neighbors(col,row,hex=false){
    if(hex)return (col%2===0?[[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]]:[[1,1],[1,0],[0,-1],[-1,0],[-1,1],[0,1]]).map(([dc,dr])=>({col:col+dc,row:row+dr}));
    const tiles=[];
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(dc||dr)tiles.push({col:col+dc,row:row+dr});
    return tiles;
  }
  function canPlace(board,cols,rows,col,row,hex=false){
    return Number.isInteger(col)&&Number.isInteger(row)&&col>=0&&row>=0&&col<cols&&row<rows&&
      neighbors(col,row,hex).every(p=>p.col<0||p.row<0||p.col>=cols||p.row>=rows||!board[p.row*cols+p.col]);
  }
  const api={neighbors,canPlace};
  if(typeof module!=='undefined')module.exports=api;else root.SettlementSpacing=api;
})(typeof globalThis==='undefined'?window:globalThis);
