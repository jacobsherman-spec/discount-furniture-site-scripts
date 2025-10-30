// HEALTHREST CUTAWAY — waits for Ecwid PDP to render
(function(){
  function init(){
    const root = document.querySelector('.ec-store .product-details__description');
    if(!root || root.dataset.healthrestInit) return;
    root.dataset.healthrestInit = 'true';

    // default active
    const firstBtn   = root.querySelector('.mattress-features__cutaway-feature-icon[data-feature="feature-0"]');
    const firstPanel = root.querySelector('#feature-0');
    if(firstBtn)   firstBtn.classList.add('mattress-features__cutaway-feature-icon--active');
    if(firstPanel) firstPanel.classList.add('is-active');

    // click handling
    root.addEventListener('click', function(e){
      const btn = e.target.closest('.mattress-features__cutaway-feature-icon');
      if(!btn) return;
      const id = btn.getAttribute('data-feature');
      const panel = root.querySelector('#' + id);
      if(!panel) return;

      root.querySelectorAll('.mattress-features__cutaway-feature-icon')
          .forEach(b => b.classList.remove('mattress-features__cutaway-feature-icon--active'));
      btn.classList.add('mattress-features__cutaway-feature-icon--active');

      root.querySelectorAll('.mattress-features__feature')
          .forEach(p => p.classList.remove('is-active'));
      panel.classList.add('is-active');
    });
  }

  // wait for Ecwid API
  if (window.Ecwid && Ecwid.OnAPILoaded) {
    Ecwid.OnAPILoaded.add(init);
  } else {
    document.addEventListener('ecwidOnAPILoaded', init);
  }

  // safety fallback in case event misses
  setTimeout(init, 2000);
})();

