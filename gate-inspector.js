(() => {
  "use strict";
  const root=document.getElementById("refinement-gate");
  const samples=window.SnapMatGateSamples;
  if(!root||!samples?.length)return;
  const el=id=>root.querySelector("#gs-"+id);
  const photo=el("photo"), overlay=el("overlay"), zoom=el("zoom"), tiles=[...root.querySelectorAll("canvas")];
  const probe=document.createElement("canvas");
  probe.width=probe.height=1;
  const pixel=probe.getContext("2d",{willReadFrequently:true});
  const asset=(id,name)=>"assets/gate-study/"+id+"/"+name;
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  let active, images, x, y, version=0, frame=0, drag=null, drawVersion=0;
  const cache=new Map();
  const buttons=samples.map(row=>{
    const btn=document.createElement("button"), thumb=new Image();
    btn.type="button";btn.setAttribute("aria-label","Inspect "+row.source);btn.setAttribute("aria-pressed","false");
    thumb.alt="";thumb.loading="lazy";thumb.src=asset(row.id,"thumb.jpg");btn.append(thumb);
    btn.addEventListener("click",()=>select(row));el("samples").append(btn);return btn;
  });
  async function load(url){
    const im=new Image();im.src=url;await im.decode();return im;
  }
  async function select(row){
    const request=++version;
    root.setAttribute("aria-busy","true");el("status").textContent="Loading portrait…";
    try{
      const [rgb,mask]=await Promise.all([load(asset(row.id,"overview.jpg")),load(row.mask)]);
      if(request!==version)return;
      if(mask.naturalWidth!==row.width||mask.naturalHeight!==row.height)throw Error("Unmatched gate");
      active=row;[x,y]=row.point;cache.clear();
      images={rgb,mask};
      el("rgb").src=images.rgb.src;el("mask").src=images.mask.src;
      photo.style.setProperty("--gs-ratio",row.width/row.height);
      buttons.forEach((b,i)=>b.setAttribute("aria-pressed",String(samples[i]===row)));
      el("coverage").textContent=(100*row.coverage).toFixed(2)+"%";
      await paint();
    }catch{if(request===version)el("status").textContent="Could not load this portrait. Select its thumbnail to retry.";}
    finally{if(request===version)root.removeAttribute("aria-busy");}
  }
  function getTile(tx,ty){
    const row=active,key=tx+"-"+ty;
    let pending=cache.get(key);
    if(!pending){
      pending=Promise.all(["rgb.jpg","coarse.png","delta.png","refined.png"].map(n=>load(asset(row.id,key+"-"+n))));
      pending.catch(()=>{if(cache.get(key)===pending)cache.delete(key);});
    }
    cache.delete(key);cache.set(key,pending);
    if(cache.size>12)cache.delete(cache.keys().next().value);
    return pending.then(layers=>({tx,ty,layers}));
  }
  async function paint(){
    if(!active)return;
    const draw=++drawVersion;
    const {width:w,height:h}=active, side=Math.round(Math.min(w,h)/Number(zoom.value));
    const left=clamp(Math.round(x-side/2),0,w-side), top=clamp(Math.round(y-side/2),0,h-side);
    const roi=el("roi").style, point=el("point").style;
    roi.left=100*left/w+"%";roi.top=100*top/h+"%";roi.width=100*side/w+"%";roi.height=100*side/h+"%";
    point.left=100*(x+.5)/w+"%";point.top=100*(y+.5)/h+"%";
    el("mask").hidden=!overlay.checked;el("crop-label").textContent=overlay.checked?"Gate overlay":"Input RGB";
    pixel.clearRect(0,0,1,1);pixel.drawImage(images.mask,x,y,1,1,0,0,1,1);
    const inside=pixel.getImageData(0,0,1,1).data[3]!==0;
    el("position").textContent=(inside?"Inside":"Outside")+" gate · ("+x+", "+y+")";
    const size=active.tile, jobs=[];
    for(let ty=Math.floor(top/size);ty<=Math.floor((top+side-1)/size);ty++){
      for(let tx=Math.floor(left/size);tx<=Math.floor((left+side-1)/size);tx++)jobs.push(getTile(tx,ty));
    }
    let chunks;
    try{chunks=await Promise.all(jobs);}
    catch{if(draw===drawVersion)el("status").textContent="Could not load the detail crop. Select the portrait to retry.";return;}
    if(draw!==drawVersion)return;
    el("status").textContent="";
    for(const [i,canvas] of tiles.entries()){
      const n=Math.max(1,Math.round(canvas.clientWidth*(window.devicePixelRatio||1)));
      if(canvas.width!==n||canvas.height!==n)canvas.width=canvas.height=n;
      const ctx=canvas.getContext("2d");
      ctx.imageSmoothingEnabled=true;ctx.globalAlpha=1;ctx.clearRect(0,0,n,n);
      for(const {tx,ty,layers} of chunks){
        const im=layers[i], dx=tx*size-left, dy=ty*size-top;
        const x0=Math.round(dx*n/side), y0=Math.round(dy*n/side);
        ctx.drawImage(im,x0,y0,Math.round((dx+im.naturalWidth)*n/side)-x0,Math.round((dy+im.naturalHeight)*n/side)-y0);
      }
      if(i===0&&overlay.checked){
        ctx.imageSmoothingEnabled=false;ctx.globalAlpha=.56;ctx.drawImage(images.mask,left,top,side,side,0,0,n,n);ctx.globalAlpha=1;
      }
    }
    root.dataset.crop=[active.id,x,y,zoom.value,overlay.checked].join(":");
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;paint();});}
  function move(e){
    const r=photo.getBoundingClientRect();
    x=clamp(Math.floor((e.clientX-r.left)*active.width/r.width),0,active.width-1);
    y=clamp(Math.floor((e.clientY-r.top)*active.height/r.height),0,active.height-1);schedule();
  }
  photo.addEventListener("pointerdown",e=>{
    if(!active||!e.isPrimary||e.button!==0)return;
    drag=e.pointerId;photo.setPointerCapture(drag);move(e);
  });
  photo.addEventListener("pointermove",e=>{if(drag===e.pointerId)move(e);});
  photo.addEventListener("lostpointercapture",()=>{drag=null;});
  photo.addEventListener("keydown",e=>{
    if(!active)return;
    const v={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(!v)return;e.preventDefault();
    const step=e.shiftKey?32:1;
    x=clamp(x+v[0]*step,0,active.width-1);y=clamp(y+v[1]*step,0,active.height-1);schedule();
  });
  overlay.addEventListener("change",schedule);zoom.addEventListener("change",schedule);
  new ResizeObserver(schedule).observe(tiles[0]);
  const near=new IntersectionObserver(([entry])=>{
    if(!entry.isIntersecting)return;near.disconnect();if(!version)select(samples[0]);
  },{rootMargin:"250px"});
  near.observe(root);
})();
