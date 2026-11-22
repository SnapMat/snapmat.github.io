(() => {
  "use strict";
  const get=id=>document.getElementById("vc-"+id);
  const player=get("player"), master=get("input"), result=get("output"), pair=[master,result];
  const frame=get("frame"), wipe=get("wipe"), play=get("play"), time=get("time"), status=get("status");
  const dir="videos/视频.zip/视频/视频/", derivatives="assets/video-studies/";
  const clips=[
    ["duet","二人跳","Dance duet",3840,2160,30000/1001,"original.mp4","green_light.mp4"],
    ["solo","跳舞2","Outdoor dance",864,1536,30,"reference.mp4"],
    ["running","二人慢跑","Running duo",1920,1080,25],
    ["street","街舞","Street dance",1080,1920,25],
    ["basketball","篮球","Basketball",1920,1080,30000/1001],
    ["dance","跳舞1","Dance solo",2560,1440,24000/1001]
  ].map(([id,folder,label,w,h,fps,input="original.mp4",green="green.mp4"])=>({
    id,label,w,h,fps,input:dir+folder+"/"+input,green:dir+folder+"/"+green,alpha:derivatives+id+"/alpha.mp4"
  }));
  const fmt=t=>Math.floor(t/60)+":"+String(Math.floor(t%60)).padStart(2,"0");
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  let clip=clips[0], mode="green", wanted=!matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visible=false, loaded=false, busy=false, failed=false, run, draw=0, duration=0, split=50, dragging=null;
  const modes=[...player.querySelectorAll("[data-output]")];
  const picks=clips.map(item=>{
    const b=document.createElement("button"), im=new Image();
    b.type="button";b.title=item.label;b.setAttribute("aria-label",item.label);
    im.alt="";im.src=derivatives+item.id+"/thumb.jpg";b.append(im);get("clips").append(b);
    b.onclick=()=>{if(item!==clip||failed){clip=item;update(0);}};return b;
  });
  function describe(){
    picks.forEach((b,i)=>b.setAttribute("aria-pressed",String(clips[i]===clip)));
    modes.forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.output===mode)));
    get("tag").textContent=mode==="green"?"Green screen":"Alpha";
    get("meta").textContent=clip.w+" × "+clip.h+" · "+Number(clip.fps.toFixed(2))+" fps";
    player.style.setProperty("--ratio",clip.w/clip.h);
  }
  function playingUI(on){
    play.classList.toggle("playing",on);play.title=failed?"Retry":on?"Pause":"Play";play.setAttribute("aria-label",play.title);
  }
  function stop(){pair.forEach(v=>v.pause());result.playbackRate=1;cancelAnimationFrame(draw);playingUI(false);}
  function wait(v,event,test,signal){
    if(signal.aborted)return Promise.reject(signal.reason);
    if(test())return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const finish=err=>{clearTimeout(timer);v.removeEventListener(event,check);v.removeEventListener("error",error);
        signal.removeEventListener("abort",cancel);err?reject(err):resolve();};
      const check=()=>{if(test())finish();},error=()=>finish(Error("Video unavailable")),cancel=()=>finish(signal.reason);
      const timer=setTimeout(error,20000);
      v.addEventListener(event,check);v.addEventListener("error",error);signal.addEventListener("abort",cancel,{once:true});
      if(v.error)error();else check();
    });
  }
  function clock(){
    time.value=master.currentTime;
    get("clock").textContent=fmt(master.currentTime)+" / "+fmt(duration);
    time.setAttribute("aria-valuetext",get("clock").textContent);
  }
  function tick(){
    if(busy||master.paused||result.paused)return;
    clock();
    const drift=master.currentTime-result.currentTime;
    if(!result.seeking){
      if(Math.abs(drift)>Math.max(.09,2/clip.fps)){update(master.currentTime);return;}
      result.playbackRate=Math.abs(drift)>.5/clip.fps?(drift>0?1.04:.96):1;
    }
    draw=requestAnimationFrame(tick);
  }
  async function update(at=master.currentTime){
    run?.abort();run=new AbortController();const {signal}=run;
    const retry=failed;failed=false;busy=true;stop();describe();
    const later=setTimeout(()=>{if(!signal.aborted){status.textContent="Loading…";status.hidden=false;}},350);
    try{
      await Promise.all(pair.map(async(v,i)=>{
        const url=i?clip[mode]:clip.input;
        if(v.getAttribute("src")!==url||retry){v.src=url;v.load();}
        await wait(v,"loadeddata",()=>v.readyState>=2,signal);
        if(v.videoWidth!==clip.w||v.videoHeight!==clip.h)throw Error("Unmatched dimensions");
      }));
      if(signal.aborted)return;
      if(Math.abs(master.duration-result.duration)>1.5/clip.fps)throw Error("Unmatched duration");
      duration=Math.min(master.duration,result.duration);time.max=duration;time.step=1/clip.fps;
      const target=clamp(at,0,Math.max(0,duration-.5/clip.fps));
      await Promise.all(pair.map(async v=>{
        if(Math.abs(v.currentTime-target)>.25/clip.fps)v.currentTime=target;
        await wait(v,"seeked",()=>!v.seeking&&v.readyState>=2,signal);
      }));
      if(signal.aborted)return;
      loaded=true;clock();status.hidden=true;
      if(wanted&&visible&&!document.hidden){
        await Promise.all(pair.map(v=>v.play()));
        if(signal.aborted)return;
        playingUI(true);
      }
      busy=false;tick();
    }catch(e){
      if(signal.aborted)return;
      busy=false;wanted=false;failed=e.name!=="NotAllowedError";stop();
      status.textContent="Video unavailable. Press play to retry.";status.hidden=!failed;
    }finally{clearTimeout(later);}
  }
  modes.forEach(b=>b.onclick=()=>{if(mode!==b.dataset.output||failed){mode=b.dataset.output;update();}});
  play.onclick=()=>{wanted=!wanted||failed;update();};
  time.addEventListener("input",()=>update(Number(time.value)));
  function splitAt(n){
    split=clamp(n,0,100);player.style.setProperty("--wipe",split+"%");
    wipe.setAttribute("aria-valuenow",Math.round(split));wipe.setAttribute("aria-valuetext",Math.round(split)+"% RGB");
  }
  function point(e){const r=frame.getBoundingClientRect();splitAt((e.clientX-r.left)/r.width*100);}
  frame.addEventListener("pointerdown",e=>{
    if(e.button!==0||!e.isPrimary)return;
    dragging=e.pointerId;frame.setPointerCapture(dragging);point(e);
  });
  frame.addEventListener("pointermove",e=>{if(e.pointerId===dragging)point(e);});
  frame.addEventListener("lostpointercapture",()=>{dragging=null;});
  wipe.onkeydown=e=>{
    const step=e.shiftKey?10:1,n={Home:0,End:100,ArrowLeft:split-step,ArrowRight:split+step}[e.key];
    if(n!==undefined){e.preventDefault();splitAt(n);}
  };
  const full=get("full");full.hidden=!document.fullscreenEnabled;
  full.onclick=async()=>{try{if(document.fullscreenElement===player)await document.exitFullscreen();else await player.requestFullscreen();}catch{}};
  document.addEventListener("fullscreenchange",()=>{full.title=document.fullscreenElement===player?"Exit fullscreen":"Enter fullscreen";full.setAttribute("aria-label",full.title);});
  pair.forEach(v=>{
    v.addEventListener("ended",()=>{if(!busy&&wanted&&visible)update(0);});
    v.addEventListener("waiting",()=>{if(!busy&&wanted&&visible&&!v.seeking&&v.readyState<3)update();});
  });
  function visibility(){
    if(visible&&!document.hidden){update(loaded?master.currentTime:0);}
    else{run?.abort();busy=false;stop();status.hidden=true;}
  }
  new IntersectionObserver(([e])=>{
    if(visible===e.isIntersecting)return;visible=e.isIntersecting;visibility();
  },{threshold:0}).observe(player);
  document.addEventListener("visibilitychange",visibility);
  describe();splitAt(50);
})();
