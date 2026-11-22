(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const viewer = $("image-viewer"), photo = $("compare-photo"), slider = $("image-split");
  const lens = $("image-lens"), surface = $("lens-surface"), toggle = $("lens-toggle");
  const notice = $("image-feedback");
  const guides = $("detail-guides");
  const cases = {};
  const host=document.querySelector(".image-picker");
  const candidates=new Map(window.HHM2K_SHORTLIST.map(r=>[r.rank,r]));
  const resolveRanks=csv=>[...new Set((csv||"").split(",").map(Number))].map(n=>candidates.get(n)).filter(Boolean);
  const review=resolveRanks(new URLSearchParams(location.search).get("selection"));
  const studies="assets/image-studies/";
  const featured=[
    {key:"hhm-050",label:"Loose hair",size:[3240,2160],focus:[132/648,260/432],guides:[{label:"Hair tips"}],rgb:"assets/image-examples/hhm-050-rgb.webp"},
    {key:"portrait-3",label:"Window light",size:[3648,5472],focus:[.346,.642],guides:[{label:"Beard"},{label:"Hair strands",at:[994.5/3648,2227/5472]}]},
    {key:"hhm-094",label:"Eyelashes",size:[2200,2750],focus:[102/440,153/550]}
  ].map(r=>{
    const base=studies+r.key;
    cases[r.key]={...r,rgb:r.rgb||base+"-rgb.webp",green:base+"-green.webp",native:base+"-green-native.webp"};
    return {key:r.key,label:r.label,thumb:base+"-picker.webp"};
  });
  function portrait(r){
      const badge=String(r.rank).padStart(3,"0"),key="review-"+badge,base="hhm2k-review/";
      cases[key]={label:"HHM2K portrait",size:[r.width,r.height],focus:[.5,.5],
        rgb:base+"previews/"+badge+"-rgb.webp",green:base+"previews/"+badge+"-green.webp",
        native:base+"images/"+badge+"-green.png"};
      return {key,label:r.id,title:"",thumb:base+"images/"+badge+"-thumb.webp"};
  }
  const studiesByKey=new Map(featured.map(row=>[row.key,row]));
  const gallery=review.length?review.map(portrait):host.dataset.selection.split(",").map(id=>
    studiesByKey.get(id)||portrait(candidates.get(Number(id)))
  );
  const rail=window.SnapMatSkinRail.create(host,{loop:true,showCount:false,labels:["Previous image","Next image"],onPick:choose});
  const clamp = (n, low=0, high=1) => Math.max(low, Math.min(n, high));
  let key = photo.dataset.example, selected = 0, split = .5, focus = [.5,.5], magnifying = false;
  let nativeGreen, nativeRequest, guide = 0, paint = 0;
  const preview = [$("compare-rgb"), $("compare-green")];
  const coach = $("lens-coach"), coachKey = "snapmat:magnifier-tip:v1";
  let coachDismissed = false;
  try { coachDismissed = localStorage.getItem(coachKey) === "1"; } catch {}
  const coachObserver = new IntersectionObserver(([entry])=>{
    if (!entry.isIntersecting || coachDismissed) return;
    coach.hidden = false; toggle.classList.add("is-guided");
    toggle.setAttribute("aria-describedby","lens-coach-text");
    coachObserver.disconnect();
  },{threshold:.95});
  if (!coachDismissed) coachObserver.observe(toggle);
  function dismissCoach() {
    if (coachDismissed) return;
    coachDismissed = true; coachObserver.disconnect();
    coach.hidden = true; toggle.classList.remove("is-guided"); toggle.removeAttribute("aria-describedby");
    try { localStorage.setItem(coachKey,"1"); } catch {}
  }
  $("lens-coach-dismiss").addEventListener("click",()=>{
    dismissCoach(); toggle.focus({preventScroll:true});
  });

  function setSplit(n) {
    split = clamp(n);
    viewer.style.setProperty("--split", split * 100 + "%");
    slider.setAttribute("aria-valuenow", String(Math.round(split * 100)));
    slider.setAttribute("aria-valuetext", Math.round(split * 100) + "% RGB");
  }
  async function loadImage(src) {
    const im = new Image();
    im.src = src; await im.decode(); return im;
  }
  async function previewPair(id) {
    const pair = await Promise.all([cases[id].rgb, cases[id].green].map(loadImage));
    if (pair[0].naturalWidth !== pair[1].naturalWidth || pair[0].naturalHeight !== pair[1].naturalHeight) throw Error("Unmatched pair");
    return pair;
  }
  function requestPaint() {
    if (!paint) paint = requestAnimationFrame(drawLens);
  }
  function drawLens() {
    paint = 0;
    if (!magnifying) return;
    const green = nativeGreen || preview[1];
    if (!green.complete || !green.naturalWidth) return;
    const w = photo.clientWidth, h = photo.clientHeight, size = lens.offsetWidth;
    if (!w || !h || size < 5) return;
    const px = focus[0]*w, py = focus[1]*h;
    lens.style.left = clamp(px-size/2,0,w-size) + "px";
    lens.style.top = clamp(py-size/2,0,h-size) + "px";
    const diameter = lens.clientWidth, dpr = window.devicePixelRatio || 1, pixels = Math.round(diameter*dpr);
    if (lens.width !== pixels || lens.height !== pixels) lens.width = lens.height = pixels;
    const ctx = lens.getContext("2d");
    const z = 3.5;
    ctx.setTransform(pixels/diameter,0,0,pixels/diameter,0,0);
    ctx.fillStyle = "#090c10"; ctx.fillRect(0,0,diameter,diameter);
    ctx.drawImage(green,diameter/2-px*z,diameter/2-py*z,w*z,h*z);
  }
  function showGuides() {
    const detail=cases[key];
    guides.replaceChildren(...(detail?.guides||[]).map(({label,at=detail.focus})=>{
      const button=document.createElement("button"), tip=document.createElement("span");
      button.type="button";button.className="detail-hint";button.setAttribute("aria-label","Magnify "+label.toLowerCase());
      button.setAttribute("aria-controls","lens-surface");
      button.style.setProperty("--lens-x",at[0]*100+"%");button.style.setProperty("--lens-y",at[1]*100+"%");
      tip.className="lens-tip";tip.textContent=label;button.append(tip);
      button.addEventListener("click",()=>magnify(true,at));
      return button;
    }));
    guides.hidden=magnifying||!guides.childElementCount;
  }
  function magnify(on, at) {
    if (magnifying === on) return;
    if (on && !cases[key]) return;
    magnifying = on; surface.hidden = !on;
    guides.hidden=on||!guides.childElementCount;
    toggle.setAttribute("aria-pressed", String(on));
    toggle.title = on ? "Close magnifier" : "Magnify green-screen detail";
    slider.tabIndex = on ? -1 : 0;
    slider.setAttribute("aria-hidden", String(on));
    if (!on) return;
    dismissCoach();
    focus = [...(at||cases[key].focus)];
    surface.focus({preventScroll:true}); requestPaint();
    if (!nativeRequest) {
      const [w,h] = cases[key].size;
      surface.setAttribute("aria-busy","true");
      const request = nativeRequest = loadImage(cases[key].native);
      request.then(im => {
        if (nativeRequest !== request) return;
        if (im.naturalWidth !== w || im.naturalHeight !== h) throw Error("Mismatched native image");
        nativeGreen = im; surface.setAttribute("aria-busy","false"); requestPaint();
      }).catch(() => {
        if (nativeRequest !== request) return;
        nativeRequest = null; surface.setAttribute("aria-busy","false");
        if (magnifying) notice.textContent = "Full-resolution image unavailable; showing the preview.";
      });
    }
  }
  async function choose(id) {
    const version = ++selected;
    viewer.removeAttribute("aria-busy"); notice.textContent = "";
    if (id === key) return;
    viewer.setAttribute("aria-busy","true"); stopGuide();
    try {
      const pair = await previewPair(id);
      if (selected !== version) return;
      magnify(false); nativeGreen = nativeRequest = null; key = id; focus = [...cases[id].focus];
      showGuides();
      const [w,h] = cases[id].size;
      pair.forEach((im,i) => { preview[i].src = im.src; });
      preview[0].alt = cases[id].label + ": original RGB";
      preview[1].alt = cases[id].label + ": SnapMat green-screen composite";
      photo.style.setProperty("--image-ratio", w/h); setSplit(.5);
      rail.render(gallery,id);
    } catch {
      if (selected === version) {notice.textContent = "This image could not be loaded. Select it to retry.";rail.render(gallery,key);}
    } finally {
      if (selected === version) viewer.removeAttribute("aria-busy");
    }
  }
  function coords(e) {
    const r = photo.getBoundingClientRect();
    return [clamp((e.clientX-r.left)/r.width),clamp((e.clientY-r.top)/r.height)];
  }
  let drag = null;
  slider.addEventListener("pointerdown", e=>{
    if (magnifying || e.button !== 0 || !e.isPrimary) return;
    drag = {id:e.pointerId, x:e.clientX, start:split, width:photo.getBoundingClientRect().width, moved:false};
    slider.setPointerCapture(e.pointerId);
  });
  slider.addEventListener("pointermove",e=>{
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 4) return;
    drag.moved = true; setSplit(drag.start + dx/drag.width);
  });
  slider.addEventListener("lostpointercapture",()=>{drag=null;});
  slider.addEventListener("keydown",e=>{
    const step = e.shiftKey ? .10 : .01;
    const n = {Home:0,End:1,ArrowLeft:split-step,ArrowRight:split+step}[e.key];
    if(n !== undefined) { e.preventDefault(); stopGuide(); setSplit(n); }
  });
  toggle.addEventListener("click",()=>{stopGuide(); magnify(!magnifying);if(!magnifying)toggle.focus({preventScroll:true});});
  surface.addEventListener("pointerdown",e=>{
    if (e.button !== 0 || !e.isPrimary) return;
    surface.setPointerCapture(e.pointerId); focus=coords(e); requestPaint();
  });
  surface.addEventListener("pointermove",e=>{
    if (e.isPrimary && (e.pointerType === "mouse" || surface.hasPointerCapture(e.pointerId))) { focus=coords(e); requestPaint(); }
  });
  surface.addEventListener("keydown",e=>{
    if(e.key==="Escape"){magnify(false);toggle.focus();return;}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(delta){e.preventDefault();focus=focus.map((n,i)=>clamp(n+delta[i]*(e.shiftKey ? .06 : .012)));requestPaint();}
  });
  new ResizeObserver(()=>{if(magnifying)requestPaint();}).observe(photo);
  preview.forEach(im=>im.addEventListener("load",()=>{if(magnifying) requestPaint();}));

  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  let interacted=false;
  function stopGuide(){interacted=true;cancelAnimationFrame(guide);guide=0;}
  viewer.addEventListener("pointerdown",stopGuide,{capture:true,passive:true});
  viewer.addEventListener("focusin",stopGuide);
  const intro=new IntersectionObserver(entries=>{
    if(!entries.some(e=>e.isIntersecting))return;
    intro.disconnect();
    if(interacted || reduced.matches || document.documentElement.classList.contains("motion-off"))return;
    try{if(sessionStorage.getItem("snapmat-wipe-seen"))return;sessionStorage.setItem("snapmat-wipe-seen","1");}catch{}
    const start=performance.now();
    function frame(now){
      if(interacted || reduced.matches || document.documentElement.classList.contains("motion-off"))return;
      const t=clamp((now-start)/1150);
      setSplit(.5+.115*(1-Math.cos(t*2*Math.PI))/2);
      if(t<1)guide=requestAnimationFrame(frame);
    }
    guide=requestAnimationFrame(frame);
  },{threshold:.2});
  intro.observe(photo);
  showGuides();
  new IntersectionObserver(([entry])=>photo.classList.toggle("guides-in-view",entry.isIntersecting),{threshold:.2}).observe(photo);
  rail.render(gallery,gallery[0].key);
  if(gallery[0].key!==key)choose(gallery[0].key);
})();
