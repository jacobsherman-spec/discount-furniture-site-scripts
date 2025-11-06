/*! HealthRest FOAM — page-specific guard (Rapture Foam)
    Page wrapper: .ec-store__product-page--768094097 */
(function(){
  var foamPage = document.querySelector('.ec-store__product-page--768094097');
  if (!foamPage) return; // Only run on the foam product page

  // If your global code exposes a pin initializer, no-op it here
  if (window.HR && typeof window.HR.initPins === 'function') {
    var original = window.HR.initPins;
    window.HR.initPins = function(){ return; };
  }

  // Defensive neutralizer in case any script tries to override later
  function protect(){
    var cont = foamPage.querySelector('.mattress-features__cutaway-container');
    var img  = foamPage.querySelector('.mattress-features__cutaway-image');
    if (cont){
      cont.style.setProperty('position','relative','important');
      cont.style.setProperty('display','inline-block','important');
      cont.style.setProperty('width','fit-content','important');
      cont.style.setProperty('max-width','100%','important');
      cont.style.setProperty('overflow','visible','important');
      cont.style.setProperty('text-align','left','important');
    }
    if (img){
      img.style.setProperty('position','static','important');
      img.style.setProperty('display','block','important');
      img.style.setProperty('width','100%','important');
      img.style.setProperty('height','auto','important');
      img.style.setProperty('object-fit','initial','important');
      img.style.setProperty('margin','0','important');
      img.style.setProperty('float','none','important');
    }
    foamPage.querySelectorAll('.mattress-features__cutaway-feature-icon').forEach(function(pin){
      pin.style.setProperty('position','absolute','important');
      pin.style.setProperty('inset','auto','important');
      pin.style.setProperty('right','auto','important');
      pin.style.setProperty('bottom','auto','important');
      pin.style.setProperty('transform','translate(-50%, -50%)','important');
      // left/top values come from your description HTML or the foam CSS file
    });
  }

  protect();
  window.addEventListener('resize', protect);
  new MutationObserver(protect).observe(foamPage, {subtree:true, attributes:true, attributeFilter:['style','class']});
})(); 
