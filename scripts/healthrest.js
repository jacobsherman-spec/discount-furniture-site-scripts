// HEALTHREST CUTAWAY — robust init for Ecwid InstantSite
(function(){
  const STATE = { inited: false };

  function hasSection(){
    return document.querySelector('.ec-store .product-details__description .mattress-features__cutaway-container');
  }

  function init(){
    if (STATE.inited) return;
    const root = document.querySelector('.ec-store .product-details__description');
    if (!root || !hasSection()) return; // wait until markup exists

    // mark as initialized (per page render)
    STATE.inited = true;

    // Ensure a visible default if merchant removed inline styles
    const firstBtn   = root.querySelector('.mattress-features__cutaway-feature-icon[data-feature="feature-0"]');
    const firstPanel = root.querySelector('#feature-0');
    if (firstBtn)   firstBtn.classList.add('mattress-features__cutaway-feature-icon--active');
    if (firstPanel) firstPanel.classList.add('is-active');

    // Event delegation on the description root
    root.addEventListener('click', function(e){
      const btn = e.target.closest('.mattress-features__cutaway-feature-icon');
      if(!btn || !root.contains(btn)) return;

      const id = btn.getAttribute('data-feature');
      const panel = id && root.querySelector('#' + id);
      if(!panel) return;

      // toggle icon state
      root.querySelectorAll('.mattress-features__cutaway-feature-icon')
          .forEach(b => b.classList.remove('mattress-features__cutaway-feature-icon--active'));
      btn.classList.add('mattress-features__cutaway-feature-icon--active');

      // toggle panels
      root.querySelectorAll('.mattress-features__feature')
          .forEach(p => p.classList.remove('is-active'));
      // if the target had inline display:none, our CSS .is-active will override it
      panel.classList.add('is-active');
    });
  }

  /* ---------- Ecwid lifecycle handling ----------- */
  function tryInit(){
    // Re-run on each call until we succeed (markup present)
    if (!STATE.inited) init();
  }

  // 1) Ecwid API ready → hook page changes
  function hookEcwid(){
    if (!window.Ecwid) return false;

    // Fire on initial load + whenever user navigates inside the store
    Ecwid.OnAPILoaded.add(tryInit);
    if (Ecwid.OnPageLoaded) {
      Ecwid.OnPageLoaded.add(function(p){
        // Reset between internal navigations (PRODUCT page type)
        if (p && p.type === 'PRODUCT') { STATE.inited = false; }
        tryInit();
      });
    }
    // As products load (some templates render description late)
    if (Ecwid.OnProductsLoaded) {
      Ecwid.OnProductsLoaded.add(tryInit);
    }
    return true;
  }

  // 2) If Ecwid isn’t available yet, listen for its global event
  document.addEventListener('ecwidOnAPILoaded', tryInit);

  // 3) MutationObserver as a last-resort (when Ecwid events are missed)
  const mo = new MutationObserver(function(){
    if (!STATE.inited && hasSection()) tryInit();
  });
  mo.observe(document.documentElement, { childList:true, subtree:true });

  // 4) Polling fallback (very light)
  let ticks = 0;
  const iv = setInterval(function(){
    if (STATE.inited) return clearInterval(iv);
    if (++ticks > 40) return clearInterval(iv); // ~20s cap
    tryInit();
  }, 500);

  // 5) Kick once now too
  hookEcwid();
  tryInit();
})();

