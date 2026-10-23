// Embedded CDN URLs are not player-facing portal pages. Until a portal supplies
// its invite API, use our public game as the interoperable room entry point.
const PortalLinks=(()=>{
 const publicURL='https://j-davidsm.github.io/Warborn/';
 function inviteURL(room,href=location.href,embedded=window.self!==window.top){
  const current=new URL(href);
  const url=new URL(embedded||current.protocol==='file:'?publicURL:current.href);
  url.search='';url.hash='';url.searchParams.set('room',room);
  return url.href;
 }
 return {inviteURL};
})();
if(typeof module!=='undefined')module.exports=PortalLinks;
