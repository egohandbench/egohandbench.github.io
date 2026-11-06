(()=>{
  'use strict';
  const nav=document.querySelector('.page-toc');if(!nav)return;
  const toggle=nav.querySelector('.toc-toggle'),links=[...nav.querySelectorAll('.toc-links a')],sections=links.map(link=>document.querySelector(link.hash));
  const close=()=>{nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open page sections')};
  toggle.addEventListener('click',()=>{const open=nav.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close page sections':'Open page sections')});
  nav.addEventListener('click',e=>{if(e.target.closest('.toc-links a'))close()});
  document.addEventListener('click',e=>{if(!nav.contains(e.target))close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('is-open')){close();toggle.focus()}});
  let pending=false;
  function update(){
    pending=false;let active=0;
    sections.forEach((section,i)=>{if(section&&section.getBoundingClientRect().top<=Math.max(140,innerHeight*.25))active=i});
    if(scrollY+innerHeight>=document.documentElement.scrollHeight-3)active=sections.length-1;
    links.forEach((link,i)=>{if(i===active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')});
  }
  addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(update)}},{passive:true});
  addEventListener('resize',()=>{close();update()});update();
})();
