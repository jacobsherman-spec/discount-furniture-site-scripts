/*! HealthRest FOAM Guard — neutralize global pin logic on .hr-foam pages */
(function () {
  var root = document.querySelector('.hr-foam');
  if (!root) return; // Only run on foam product

  function guard() {
    var container = root.querySelector('.mattress-features__cutaway-container');
    var img = root.querySelector('.mattress-features__cutaway-image');
    if (container) {
      container.style.setProperty('position','relative','important');
      container.style.setProperty('display','inline-block','important');
      container.style.setProperty('width','fit-content','important');
      container.style.setProperty('max-width','100%','important');
      container.style.setProperty('overflow','visible','important');
    }
    if (img) {
      img.style.setProperty('position','static','important');
      img.style.setProperty('display','block','important');
      img.style.setProperty('width','100%','important');
      img.style.setProperty('height','auto','important');
      img.style.setProperty('object-fit','initial','important');
      img.style.setProperty('margin','0','important');
      img.style.setProperty('float','none','important');
    }
    root.querySelectorAll('.mattress-features__cutaway-feature-icon').forEach(function(pin){
      pin.style.setProperty('position','absolute','important');
      pin.style.setProperty('inset','auto','important');
      pin.style.setProperty('right','auto','important');
      pin.style.setProperty('bottom','auto','important');
      pin.style.setProperty('transform','translate(-50%,-50%)','important');
      // left/top come from the description inline styles
    });
  }

  // Run now and keep defending against other scripts
  guard();
  window.addEventListener('resize', guard);
  new MutationObserver(guard).observe(document.body, {subtree:true, attributes:true, attributeFilter:['style','class']});
})();
