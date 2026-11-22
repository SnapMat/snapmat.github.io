(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 // Retain the image canvas when desktop page zoom shrinks the CSS viewport.
 // Ordinary window resizing remains fluid; pinch zoom stays entirely native.
 const imageSection=$('image');
 if(imageSection){
  let display='',base;
  function syncPageZoom(){
   const key='image-base-dpr:'+screen.width+'x'+screen.height;
   if(display!==key){
    display=key;base=devicePixelRatio;
    try{
     const saved=Number(sessionStorage.getItem(key));
     if(saved>0)base=saved;else sessionStorage.setItem(key,String(base));
    }catch{}
   }
   imageSection.style.setProperty('--image-page-scale',String(devicePixelRatio/base));
  }
  window.addEventListener('resize',syncPageZoom);
  syncPageZoom();
 }
 const hero=$('demo-media').querySelector('video');
 const empty=$('demo-media').querySelector('.empty');
 const quality=$('demo-quality');
 let switchSource;
 quality.addEventListener('change',()=>{
  switchSource?.abort();
  switchSource=new AbortController();
  const at=hero.currentTime, resume=!hero.paused&&!hero.ended;
  hero.addEventListener('loadedmetadata',()=>{
   hero.currentTime=Math.min(at,hero.duration);
   if(resume&&!document.hidden&&hero.getBoundingClientRect().bottom>0)hero.play().catch(()=>{});
  },{once:true,signal:switchSource.signal});
  hero.src=quality.value;hero.load();
 });
 hero.addEventListener('error',()=>{empty.hidden=false;});
 hero.addEventListener('loadeddata',()=>{empty.hidden=true;});
 // One quiet entrance per section. No looping decorative motion, no scroll hijacking.
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),root=document.documentElement;
 let manual=false;try{manual=sessionStorage.getItem('matting-reduce-motion')==='1';}catch{}
 const items=[...document.querySelectorAll('.publication-header')];
 items.forEach(el=>el.classList.add('reveal'));
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px -20px 0px'});
 function setMotion(){
  const off=manual||reduce.matches;root.classList.toggle('motion-off',off);root.classList.toggle('motion-ready',!off);
  items.forEach(el=>{if(off)el.classList.add('is-visible');else observer.observe(el);});
 }
 reduce.addEventListener('change',setMotion);setMotion();
 const heroVisibility=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)hero.pause();}),{threshold:0});
 heroVisibility.observe(hero);
 // Never keep user-started hero video running outside the tab.
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hero?.pause();});
})();
