/**
 * Discount Furniture — mattress-spin.js
 * Minimal click/tap-to-toggle feature modules (placeholder).
 * Add `[data-df-spin]` to a container with child elements `[data-df-spin-part]`.
 */
(function(){
  "use strict";

  function init(container){
    var parts = Array.from(container.querySelectorAll('[data-df-spin-part]'));
    if (!parts.length) return;
    var active = 0;

    function setActive(i){
      parts.forEach(function(el, idx){
        el.style.opacity = (idx === i ? '1' : '0');
        el.style.pointerEvents = (idx === i ? 'auto' : 'none');
      });
      active = i;
    }

    container.addEventListener('click', function(){
      setActive((active + 1) % parts.length);
    });

    setActive(0);
  }

  function run(){
    document.querySelectorAll('[data-df-spin]').forEach(init);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
