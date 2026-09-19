// Load p5 from the bundled vendor copy first, then fall back to CDN.
(function(){
  var localSrc = './vendor/p5.min.js';
  var cdnSrc = 'https://cdn.jsdelivr.net/npm/p5@1.6.0/lib/p5.min.js';
  function load(src, onload, onerror){
    var s = document.createElement('script');
    s.src = src;
    s.onload = onload;
    s.onerror = onerror;
    document.head.appendChild(s);
  }
  load(localSrc, function(){
    console.log('Loaded p5 from local:', localSrc);
  }, function(){
    console.warn('Local p5 not found, loading from CDN:', cdnSrc);
    load(cdnSrc, function(){
      console.log('Loaded p5 from CDN');
    }, function(){
      console.error('Failed to load p5 from CDN');
    });
  });
})();
