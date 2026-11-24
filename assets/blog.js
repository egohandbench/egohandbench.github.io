(()=>{
  'use strict';
  const mosaic=document.querySelector('.overview-samples');
  if(!mosaic)return;
  const examples=JSON.parse(document.getElementById('preview-data').textContent);
  const zoom=mosaic.querySelector('.hover-preview'),image=zoom.querySelector('img');
  document.body.appendChild(zoom);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const hint=mosaic.querySelector('.mosaic-cover span');
  if(hint)hint.textContent=window.matchMedia('(hover: none)').matches?'Tap to Explore':'Hover to Explore';
  let active=null,motion=null,restingTransform='none',coverReadyAt=0;
  function expose(){if(!mosaic.classList.contains('is-exploring')){mosaic.classList.add('is-exploring');coverReadyAt=performance.now()+(reducedMotion.matches?0:200)}}
  function conceal(){hide();mosaic.classList.remove('is-exploring');coverReadyAt=0}
  function hide(immediate=false){
    active=null;
    if(zoom.hidden)return;
    const start=getComputedStyle(zoom).transform;
    if(motion)motion.cancel();
    if(immediate||reducedMotion.matches){zoom.hidden=true;return}
    motion=zoom.animate([{transform:start,opacity:1},{transform:restingTransform,opacity:0}],{duration:180,easing:'cubic-bezier(.4,0,.8,.4)'});
    motion.onfinish=()=>{if(!active)zoom.hidden=true};
  }
  function magnify(tile){
    expose();active=tile;
    if(motion)motion.cancel();
    zoom.hidden=true;let revealed=false;
    const reveal=()=>{
      if(active!==tile||revealed)return;
      const delay=coverReadyAt-performance.now();if(delay>0){setTimeout(reveal,delay);return}revealed=true;
      const frame=tile.getBoundingClientRect(),ratio=image.naturalWidth/image.naturalHeight;
      const centerX=frame.left+frame.width/2,centerY=frame.top+frame.height/2;
      const availableWidth=2*Math.max(1,Math.min(centerX-8,document.documentElement.clientWidth-8-centerX));
      const availableHeight=2*Math.max(1,Math.min(centerY-8,window.innerHeight-8-centerY));
      const width=Math.min(frame.width*2.2,availableWidth,availableHeight*ratio),height=width/ratio;
      const left=centerX-width/2,top=centerY-height/2;
      restingTransform=`scale(${frame.width/width})`;
      Object.assign(zoom.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`,transformOrigin:'center center'});
      zoom.hidden=false;
      if(!reducedMotion.matches)motion=zoom.animate([{transform:restingTransform,opacity:1},{transform:'none',opacity:1}],{duration:340,easing:'cubic-bezier(.16,1,.3,1)'});
    };
    image.onload=reveal;
    image.src=examples[Number(tile.dataset.preview)].src;
    if(image.complete&&image.naturalWidth)reveal();
  }
  mosaic.querySelectorAll('[data-preview]').forEach(tile=>{
    tile.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')magnify(tile)});
    tile.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch')hide()});
    tile.addEventListener('pointerup',event=>{if(event.pointerType==='touch'){if(active===tile)conceal();else magnify(tile)}});
    tile.addEventListener('focus',()=>{if(tile.matches(':focus-visible'))magnify(tile)});
    tile.addEventListener('blur',()=>hide());
    tile.addEventListener('keydown',event=>{if(event.key==='Escape')conceal()});
  });
  mosaic.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')expose()});
  mosaic.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch')conceal()});
  document.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'&&!mosaic.contains(event.target))conceal()});
  mosaic.addEventListener('focusout',event=>{if(!mosaic.contains(event.relatedTarget))conceal()});
  const reset=()=>{hide(true);mosaic.classList.remove('is-exploring');coverReadyAt=0};
  window.addEventListener('resize',reset);
  window.addEventListener('scroll',reset,{passive:true});
})();
