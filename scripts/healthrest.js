// HEALTHREST CUTAWAY interactivity — scoped to PDP description
document.addEventListener('DOMContentLoaded', function(){
  const root = document.querySelector('.product-details__description');
  if(!root) return;

  // default active spinner/panel
  const firstBtn   = root.querySelector('.mattress-features__cutaway-feature-icon[data-feature="feature-0"]');
  const firstPanel = root.querySelector('#feature-0');
  if(firstBtn)   firstBtn.classList.add('mattress-features__cutaway-feature-icon--active');
  if(firstPanel) firstPanel.classList.add('is-active');

  // click handling
  root.addEventListener('click', function(e){
    const btn = e.target.closest('.mattress-features__cutaway-feature-icon');
    if(!btn) return;

    const id = btn.getAttribute('data-feature');
    if(!id) return;
    const panel = root.querySelector('#' + id);
    if(!panel) return;

    // toggle active icon
    root.querySelectorAll('.mattress-features__cutaway-feature-icon')
        .forEach(b => b.classList.remove('mattress-features__cutaway-feature-icon--active'));
    btn.classList.add('mattress-features__cutaway-feature-icon--active');

    // toggle panel
    root.querySelectorAll('.mattress-features__feature')
        .forEach(p => p.classList.remove('is-active'));
    panel.classList.add('is-active');
  });
});
