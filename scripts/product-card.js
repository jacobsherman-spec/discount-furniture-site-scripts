/**
 * Discount Furniture — product-card.js
 * Sticky/scrollable PDP sidebar that sizes itself to gallery height.
 * - Disables on <= 1024px by default (configurable via data-df-mobile-breakpoint)
 * - Ensures the card scrolls within itself, never over the description column
 */
(function () {
  "use strict";

  var MOBILE_BP = readNumberAttr(document.body, "df-mobile-breakpoint", 1024);
  var SIDEBAR_SEL = '.ec-store .product-details__sidebar';
  var GALLERY_SEL = '.ec-store .product-details__gallery';

  function readNumberAttr(el, name, fallback) {
    var v = (el && el.getAttribute && el.getAttribute('data-' + name)) || null;
    var n = v != null ? parseInt(v, 10) : NaN;
    return isFinite(n) ? n : fallback;
  }

  function raf(fn){ return (window.requestAnimationFrame || setTimeout)(fn, 0); }
  function onReady(fn){ /complete|interactive/.test(document.readyState) ? fn() : document.addEventListener('DOMContentLoaded', fn); }

  function applySizing() {
    var card = document.querySelector(SIDEBAR_SEL);
    var gal  = document.querySelector(GALLERY_SEL);
    if (!card || !gal) return;

    if (window.innerWidth <= MOBILE_BP) {
      card.style.maxHeight = '';
      card.style.overflowY = '';
      card.style.overscrollBehavior = '';
      card.style.position = '';
      card.style.top = '';
      return;
    }

    // Match gallery height; cap to viewport minus safe padding
    var gH = Math.max(gal.offsetHeight || 0, gal.getBoundingClientRect().height || 0);
    var viewportCap = Math.max(320, window.innerHeight - 24);
    var cap = Math.max(320, Math.min(viewportCap, gH));

    card.style.maxHeight = cap + 'px';
    card.style.overflowY = 'auto';
    card.style.overscrollBehavior = 'contain';
    card.style.position = 'sticky';
    card.style.top = '12px';
  }

  function debounce(fn, ms){
    var t; return function(){ clearTimeout(t); t = setTimeout(fn, ms); };
  }

  var handleResize = debounce(function(){ raf(applySizing); }, 100);
  var handleLoad   = function(){ raf(applySizing); };

  onReady(handleLoad);
  window.addEventListener('load', handleLoad);
  window.addEventListener('resize', handleResize);
})();
