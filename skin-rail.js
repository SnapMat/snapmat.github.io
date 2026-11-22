(() => {
  "use strict";
  const el = (tag, cls) => Object.assign(document.createElement(tag), {className:cls});
  function create(host, {loop=false, showCount=true, onPick, labels}) {
    const wrap=el("div","skin-rail"), viewport=el("div","skin-track"), count=el("div","skin-count");
    function arrow(icon,label) {
      const b=el("button","skin-arrow"), i=document.createElement("i");
      b.type="button"; b.title=label; b.setAttribute("aria-label",label);
      i.dataset.lucide=icon; b.append(i); return b;
    }
    const prev=arrow("chevron-left",labels[0]), next=arrow("chevron-right",labels[1]);
    const lane=el("div","skin-lane");
    lane.append(prev,viewport,next); wrap.append(lane); if(showCount)wrap.append(count); host.replaceChildren(wrap);
    window.lucide?.createIcons({root:wrap});
    let items=[],cards=[],pad=0,index=0,shown=0,timer,drag,suppressClick=false,wheelAt=0,aim=null;
    const reduced=()=>matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("motion-off");
    const n=i=>(i%items.length+items.length)%items.length;
    const target=c=>c.offsetLeft+(c.offsetWidth-viewport.clientWidth)/2;
    function nearest() {
      return cards.reduce((best,c,i)=>Math.abs(target(c)-viewport.scrollLeft)<Math.abs(target(cards[best])-viewport.scrollLeft)?i:best,0);
    }
    function paint(){
      cards.forEach((c,i)=>{
        const active=i===shown;
        c.classList.toggle("current",active); c.classList.toggle("before",i<shown);
        if(c.dataset.clone!=="1"){c.setAttribute("aria-pressed",String(n(i-pad)===index));c.tabIndex=n(i-pad)===index?0:-1;}
      });
      prev.disabled=items.length<2||(!loop&&index===0);
      next.disabled=items.length<2||(!loop&&index===items.length-1);
      count.textContent=items.length?String(index+1).padStart(2,"0")+" / "+String(items.length).padStart(2,"0"):"";
    }
    function center(j,smooth) {
      if(!cards[j])return;
      aim=j;
      viewport.scrollTo({left:target(cards[j]),behavior:smooth&&!reduced()?"smooth":"instant"});
    }
    function go(j,smooth=true,notify=true){
      if(!cards[j])return;
      const old=index;shown=j;index=n(j-pad);paint();center(j,smooth);
      if(notify && old!==index)onPick(items[index].key);
    }
    function settle(){
      if(drag||!cards.length)return;
      const j=nearest();
      if(aim!==null && j!==aim){center(aim,false);return;}
      aim=null;
      const old=index;index=n(j-pad);shown=index+pad;paint();center(shown,false);aim=null;
      if(old!==index)onPick(items[index].key);
    }
    function step(d){
      if(items.length<2)return;
      if(!loop && (index+d<0 || index+d>=items.length))return;
      if(!cards[shown+d]){shown=index+pad;center(shown,false);}
      go(shown+d);
    }
    prev.onclick=()=>step(-1);next.onclick=()=>step(1);
    viewport.addEventListener("scroll",()=>{clearTimeout(timer);timer=setTimeout(settle,145);},{passive:true});
    viewport.addEventListener("wheel",e=>{
      if(e.ctrlKey||e.metaKey||Math.abs(e.deltaY)<=Math.abs(e.deltaX)){aim=null;return;}
      const d=Math.sign(e.deltaY);
      if(!loop && ((d<0&&index===0)||(d>0&&index===items.length-1)))return;
      e.preventDefault(); if(performance.now()-wheelAt<180)return;
      wheelAt=performance.now();step(d);
    },{passive:false});
    viewport.addEventListener("pointerdown",e=>{
      aim=null;clearTimeout(timer);
      if(e.pointerType!=="mouse"||e.button!==0)return;
      drag={id:e.pointerId,x:e.clientX,left:viewport.scrollLeft,moved:false};
    });
    viewport.addEventListener("pointermove",e=>{
      if(!drag||e.pointerId!==drag.id)return;
      if(!e.buttons){drag=null;return;}
      const dx=e.clientX-drag.x;
      if(!drag.moved && Math.abs(dx)<5)return;
      drag.moved=true; viewport.classList.add("dragging");viewport.setPointerCapture(e.pointerId);
      viewport.scrollLeft=drag.left-dx;
    });
    function end(){
      if(!drag)return;
      const moved=drag.moved;drag=null;viewport.classList.remove("dragging");
      if(moved){suppressClick=true;go(nearest());setTimeout(()=>{suppressClick=false;},0);}
    }
    viewport.addEventListener("pointerup",end);viewport.addEventListener("pointercancel",end);
    viewport.addEventListener("click",e=>{
      const c=e.target.closest(".skin-card");if(!c||suppressClick)return;go(cards.indexOf(c));
    });
    viewport.addEventListener("keydown",e=>{
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;
      e.preventDefault();e.stopPropagation();
      if(e.key==="Home")go(pad);else if(e.key==="End")go(pad+items.length-1);else step(e.key==="ArrowLeft"?-1:1);
      cards[pad+index]?.focus({preventScroll:true});
    });
    new ResizeObserver(()=>{if(!drag)center(shown,false);}).observe(viewport);
    return {
      render(rows,key,marks) {
        const changed=rows.length!==items.length||rows.some((r,i)=>r.key!==items[i].key);
        if(changed){
          clearTimeout(timer);aim=null;items=rows;pad=loop&&rows.length>1?Math.min(2,rows.length-1):0;
          const visible=pad?[...rows.slice(-pad),...rows,...rows.slice(0,pad)]:rows;
          cards=visible.map((r,j)=>{
            const c=el("button","skin-card"),im=new Image();
            c.type="button";c.title=r.title??r.label;c.setAttribute("aria-label",r.label);
            if(j<pad||j>=pad+rows.length){c.dataset.clone="1";c.setAttribute("aria-hidden","true");c.tabIndex=-1;}
            else c.dataset.example=r.key;
            im.alt="";im.draggable=false;im.src=r.thumb;c.append(im);
            if(r.badge){const tag=el("small","skin-badge");tag.textContent=r.badge;c.append(tag);}
            return c;
          });viewport.replaceChildren(...cards);
        }
        index=Math.max(0,items.findIndex(r=>r.key===key));
        if(changed||!cards[shown]||n(shown-pad)!==index){shown=index+pad;center(shown,!changed);}
        if(marks)cards.forEach((c,i)=>{c.dataset.mark=marks(items[n(i-pad)].key)||"";});
        paint();host.hidden=!items.length;
      }
    };
  }
  window.SnapMatSkinRail={create};
})();
