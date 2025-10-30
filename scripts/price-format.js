/**
 * Discount Furniture — price-format.js
 * Superscript cents and optionally hide decimals across PDP/category.
 * Controls:
 *  - body[data-df-hide-decimals="1"] hides the decimal fraction entirely
 */
(function(){
  "use strict";

  var HIDE = document.body.getAttribute('data-df-hide-decimals') === '1';

  function formatNode(node){
    if (!node) return;
    var html = node.innerHTML;
    // Match values like 1,599.95 or 1599.95
    var m = html.match(/(\$\s*[0-9,]+)(?:\.(\d{2}))?/);
    if (!m) return;
    var dollars = m[1];
    var cents = m[2];
    if (HIDE || !cents) {
      node.innerHTML = dollars.replace(/\.$/, '');
    } else {
      node.innerHTML = dollars + '<sup class="df-cents">' + cents + '</sup>';
    }
  }

  function run(){
    var sel = [
      '.ec-store .details-product-price__value',
      '.ec-store .product-details__product-price .ec-price__value',
      '.ec-store .grid-product__price-value',
      '.ec-store .ec-price-item .ec-price__value'
    ].join(',');

    document.querySelectorAll(sel).forEach(formatNode);

    // Inject minimal CSS once
    if (!document.getElementById('df-price-css')) {
      var css = '.df-cents{font-size:.6em;vertical-align:super;line-height:1}';
      var style = document.createElement('style');
      style.id = 'df-price-css';
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
