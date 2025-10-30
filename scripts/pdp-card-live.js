(function () {
  var DESKTOP_BP = 1025;
  var SIDEBAR_SEL = '.ec-store .product-details__sidebar';
  var GALLERY_SEL = '.ec-store .product-details__gallery';

  // --- helpers ---------------------------------------------------------------
  function raf(fn){ return requestAnimationFrame(fn); }
  function debounce(fn, ms){
    var t; return function(){ clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function sizeCard() {
    var card = document.querySelector(SIDEBAR_SEL);
    var gal  = document.querySelector(GALLERY_SEL);
    if (!card || !gal) return;

    if (window.innerWidth < DESKTOP_BP) {
      card.style.maxHeight = '';
      card.style.overflowY = '';
      card.style.overscrollBehavior = '';
      return;
    }

    var gH = Math.max(gal.offsetHeight || 0, gal.getBoundingClientRect().height || 0);
    var viewportCap = Math.max(320, window.innerHeight - 24);
    var cap = Math.max(320, Math.min(viewportCap, gH));

    card.style.maxHeight = cap + 'px';
    card.style.overflowY = 'auto';
    card.style.webkitOverflowScrolling = 'touch';
    card.style.overscrollBehavior = 'contain';
  }

  // Wait until both sidebar + gallery exist before wiring observers
  function whenPdpReady(cb, tries){
    tries = tries || 0;
    var card = document.querySelector(SIDEBAR_SEL);
    var gal  = document.querySelector(GALLERY_SEL);
    if (card && gal) return cb();
    if (tries > 100) return; // ~5s guard
    setTimeout(function(){ whenPdpReady(cb, tries+1); }, 50);
  }

  var ro; // ResizeObserver for gallery height changes
  function hookGalleryObserver(){
    var gal = document.querySelector(GALLERY_SEL);
    if (!gal || !window.ResizeObserver) return;
    if (ro) ro.disconnect();
    ro = new ResizeObserver(function(){ raf(sizeCard); });
    ro.observe(gal);
  }

  function initOnce() {
    whenPdpReady(function(){
      hookGalleryObserver();
      raf(sizeCard);
      setTimeout(sizeCard, 250);   // async images
      setTimeout(sizeCard, 1000);  // late loads
    });
  }

  // Re-init on SPA navigations & viewport changes
  var debouncedSize = debounce(function(){ raf(sizeCard); }, 50);
  window.addEventListener('resize', debouncedSize);
  window.addEventListener('orientationchange', debouncedSize);

  // 1) Ecwid lifecycle callbacks
  if (window.Ecwid && Ecwid.OnPageLoaded) {
    Ecwid.OnPageLoaded.add(function(page){
      if (page && page.type === 'product') initOnce();
    });
  }
  if (window.Ecwid && Ecwid.OnAPILoaded) {
    Ecwid.OnAPILoaded.add(function(){ initOnce(); });
  }

  // 2) Fallback: watch DOM for PDP nodes when navigating from other pages
  var mo = new MutationObserver(function(muts){
    for (var i=0;i<muts.length;i++){
      var n = muts[i].target;
      if (n && (document.querySelector(SIDEBAR_SEL) && document.querySelector(GALLERY_SEL))) {
        initOnce();
        break;
      }
    }
  });
  mo.observe(document.documentElement || document.body, { childList:true, subtree:true });

  // 3) First load (direct URL)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnce);
  } else {
    initOnce();
  }
})();
