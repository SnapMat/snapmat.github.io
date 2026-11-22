(() => {
  "use strict";
  const clip=window.SnapMatSpeedClip, $=id=>document.getElementById("sc-"+id);
  if(!clip||!$("player"))return;
  const film=$("film"), play=$("play"), seek=$("seek");
  const base="assets/speed-study/", labels=["MaGGIe + SAM2","SAM2Matting","MatAnyone 2","SnapMat"];
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  let poster=null,generation=0,wanted=false,visible=false,ready=false,failed=false,frameRequest=0;
  const clock=t=>Math.floor(t/60)+":"+String(Math.floor(t%60)).padStart(2,"0");
  const lanes=labels.map((name,i)=>{
    const lane=$("lane").content.firstElementChild.cloneNode(true),find=s=>lane.querySelector(s);
    const title=find("h3"),rate=clip.rates[i];
    title.textContent=name;
    if(name==="SAM2Matting")title.replaceChildren("SAM2",document.createElement("wbr"),"Matting");
    find(".sc-resolution").textContent=["4K","4K input","1440p","4K"][i];
    find(".sc-rate").textContent=rate.toFixed(2)+" FPS";
    const canvas=find("canvas");
    $("grid").append(lane);
    return {rate,canvas,ctx:canvas.getContext("2d"),count:find(".sc-count"),
      fill:find(".sc-track i"),finish:find(".sc-finish"),total:find(".sc-finish b")};
  });
  const max=()=>clip.frames/Math.min(...clip.rates);
  function draw(media,t){
    const w=(media?.videoWidth||media?.naturalWidth||0)/2,h=(media?.videoHeight||media?.naturalHeight||0)/2;
    const elapsed=Math.min(max(),Math.max(0,t-clip.introSeconds));
    for(const [i,l] of lanes.entries()){
      if(w&&h){
        if(l.canvas.width!==w||l.canvas.height!==h){l.canvas.width=w;l.canvas.height=h;}
        l.ctx.drawImage(media,(i%2)*w,(i>>1)*h,w,h,0,0,w,h);
      }
      const total=clip.frames/l.rate;
      const p=window.RaceCore.progress(elapsed+1e-8,l.rate,clip.frames,1);
      l.count.textContent=p.frames+" / "+clip.frames+" frames";
      l.fill.style.transform="scaleX("+p.frames/clip.frames+")";
      l.finish.hidden=!p.complete;l.total.textContent=total.toFixed(1)+" s";
    }
    seek.value=elapsed;$("clock").textContent=clock(elapsed)+" / "+clock(max());
    seek.setAttribute("aria-valuetext",elapsed.toFixed(1)+" seconds");
  }
  function paint(t=film.currentTime){
    if(ready&&film.readyState>=2&&!film.seeking)draw(film,film.ended?clip.introSeconds+max():t);
    else if(!ready)draw(poster,0);
  }
  function button(){
    const active=ready&&!film.paused&&!film.ended;
    play.classList.toggle("running",active);
    play.title=failed?"Retry playback":active?"Pause comparison":film.ended?"Replay comparison":"Play comparison";
    $("play-label").textContent=play.title;
    play.setAttribute("aria-label",play.title);
  }
  function stopFrames(){
    if(!frameRequest)return;
    if(film.cancelVideoFrameCallback)film.cancelVideoFrameCallback(frameRequest);else cancelAnimationFrame(frameRequest);
    frameRequest=0;
  }
  function nextFrame(){
    if(frameRequest||film.paused||!visible||document.hidden)return;
    const cb=(_,meta)=>{frameRequest=0;paint(meta?.mediaTime??film.currentTime);nextFrame();};
    frameRequest=film.requestVideoFrameCallback?film.requestVideoFrameCallback(cb):requestAnimationFrame(cb);
  }
  function maybePlay(){
    if(!ready||!visible||!wanted||document.hidden||film.ended)return;
    if(reduced.matches&&film.currentTime<clip.introSeconds)film.currentTime=clip.introSeconds;
    const g=generation;
    film.play().catch(e=>{if(g===generation&&e.name!=="AbortError"){wanted=false;button();}});
  }
  function loadClip(){
    const g=++generation;stopFrames();film.pause();ready=false;failed=false;poster=null;
    lanes.forEach(l=>l.ctx.clearRect(0,0,l.canvas.width,l.canvas.height));
    $("error").hidden=true;seek.max=max();seek.disabled=true;button();draw(null,0);
    const im=new Image();im.onload=()=>{if(g===generation&&!ready){poster=im;draw(im,0);}};im.src=base+clip.id+".jpg";
    film.src=base+clip.id+".mp4";film.load();
  }
  film.addEventListener("loadeddata",()=>{
    ready=true;seek.disabled=false;paint();button();maybePlay();
  });
  film.addEventListener("playing",()=>{play.classList.remove("awaiting-play");button();nextFrame();});
  film.addEventListener("pause",()=>{stopFrames();paint();button();});
  film.addEventListener("seeked",()=>{paint();nextFrame();});
  film.addEventListener("ended",()=>{wanted=false;stopFrames();paint();button();});
  film.addEventListener("error",()=>{ready=false;failed=true;stopFrames();$("error").hidden=false;button();});
  function replay(){wanted=true;if(failed){loadClip();return;}film.currentTime=0;maybePlay();}
  play.onclick=()=>{
    if(failed||film.ended){replay();return;}
    if(!film.paused){wanted=false;film.pause();}else{wanted=true;maybePlay();}
  };
  $("replay").onclick=replay;
  seek.oninput=()=>{if(ready)film.currentTime=clip.introSeconds+Math.min(Number(seek.value),max());};
  function visibility(){if(visible&&!document.hidden){if(!generation)loadClip();}else{wanted=false;film.pause();}}
  new IntersectionObserver(([e])=>{
    visible=e.isIntersecting;visibility();
  }).observe($("player"));
  document.addEventListener("visibilitychange",visibility);
})();
