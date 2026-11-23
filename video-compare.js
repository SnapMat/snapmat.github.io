(() => {
  "use strict";
  const get=id=>document.getElementById("vc-"+id);
  const player=get("player"), master=get("input"), result=get("output"), pair=[master,result];
  const frame=get("frame"), wipe=get("wipe"), play=get("play"), time=get("time"), status=get("status");
  const dir="videos/视频.zip/视频/视频/", derivatives="assets/video-studies/";
  const revised="assets/video-r2/";
  function newClip(id,label,w=3840,h=2160,fps=30){return {id,label,w,h,fps,revised:true,thumb:revised+id+".jpg"};}
  function legacy(id,folder,label,w,h,fps,input="original.mp4"){
    return {id,label,w,h,fps,input:dir+folder+"/"+input,green:dir+folder+"/green.mp4",alpha:derivatives+id+"/alpha.mp4",thumb:derivatives+id+"/thumb.jpg"};
  }
  const clips=[
    newClip("duet","Dance duet"),
    legacy("solo","跳舞2","Outdoor dance",864,1536,30,"reference.mp4"),
    newClip("running","Running duo",1920,1080,25),
    legacy("street","街舞","Street dance",1080,1920,25),
    newClip("basketball","Basketball"),newClip("dance","Dance solo")
  ];
  const fmt=t=>Math.floor(t/60)+":"+String(Math.floor(t%60)).padStart(2,"0");
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  let clip=clips[0], mode="green", wanted=!matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visible=false, loaded=false, busy=false, failed=false, run, draw=0, duration=0, split=50, dragging=null;
  const modes=[...player.querySelectorAll("[data-output]")];
  const quality=get("quality");
  const hasHD=()=>clip.w>1920||clip.h>1920;
  const useHD=()=>hasHD()&&quality.value==="hd";
  const picks=clips.map(item=>{
    const b=document.createElement("button"), im=new Image();
    b.type="button";b.title=item.label;b.setAttribute("aria-label",item.label);
    im.alt="";im.src=item.thumb;b.append(im);get("clips").append(b);
    b.onclick=()=>{if(item!==clip||failed){clip=item;quality.value="hd";update(0);}};return b;
  });
  function describe(){
    picks.forEach((b,i)=>b.setAttribute("aria-pressed",String(clips[i]===clip)));
    modes.forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.output===mode)));
    get("tag").textContent=mode==="green"?"Green screen":"Alpha";
    quality.hidden=!hasHD();quality.options[1].textContent=clip.w===3840?"4K":"1440p";
    get("meta").textContent=(useHD()?"1920 × 1080":clip.w+" × "+clip.h)+" · "+Number(clip.fps.toFixed(2))+" fps";
    player.style.setProperty("--ratio",clip.w/clip.h);
  }
  function playingUI(on){
    play.classList.toggle("playing",on);play.title=failed?"Retry":on?"Pause":"Play";play.setAttribute("aria-label",play.title);
  }
  function stop(){pair.forEach(v=>v.pause());result.playbackRate=1;cancelAnimationFrame(draw);playingUI(false);}
  function notice(message,link=false){
    status.textContent=message;status.hidden=!message;
    if(link&&result.getAttribute("src")){
      const a=document.createElement("a");a.href=result.src;a.textContent=mode==="green"?"Open green-screen video":"Open alpha video";
      status.append(" ",a);
    }
  }
  function wait(v,event,test,signal){
    if(signal.aborted)return Promise.reject(signal.reason);
    if(test())return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const finish=err=>{v.removeEventListener(event,check);v.removeEventListener("error",error);
        signal.removeEventListener("abort",cancel);err?reject(err):resolve();};
      const check=()=>{if(test())finish();},error=()=>finish(Error("Video unavailable")),cancel=()=>finish(signal.reason);
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
    if(!result.seeking&&pair.every(v=>v.readyState>=3)){
      if(Math.abs(drift)>Math.max(.15,3/clip.fps))result.currentTime=master.currentTime;
      else result.playbackRate=Math.abs(drift)>.5/clip.fps?(drift>0?1.04:.96):1;
    }
    draw=requestAnimationFrame(tick);
  }
  async function update(at=master.currentTime){
    run?.abort();const attempt=run=new AbortController(),{signal}=attempt;
    const retry=failed;failed=false;busy=true;stop();describe();
    notice("");
    const later=setTimeout(()=>{if(!signal.aborted)notice("Loading…");},350);
    const slow=setTimeout(()=>{
      if(signal.aborted)return;
      attempt.abort();wanted=false;busy=false;failed=true;stop();
      notice("Still loading. Tap Play to retry.",true);
    },45000);
    try{
      pair.forEach((v,i)=>{
        const channel=i?mode:"input";
        const url=clip.revised?revised+clip.id+"-"+channel+"-"+(hasHD()&&!useHD()?"2160":"1080")+".mp4":clip[channel];
        v.preload="auto";
        if(v.getAttribute("src")!==url||retry){v.src=url;v.load();}
      });
      // Mobile browsers may not fetch the first frame until play() runs in the tap handler.
      const start=wanted&&visible&&!document.hidden;
      const starts=start?pair.map(v=>v.play()):[];
      await Promise.all([...starts,...pair.map(v=>wait(v,"loadedmetadata",()=>v.readyState>=1,signal))]);
      if(signal.aborted)return;
      if(start)playingUI(true);
      duration=Math.min(master.duration,result.duration);time.max=duration;time.step=1/clip.fps;
      const target=clamp(at,0,Math.max(0,duration-.5/clip.fps));
      await Promise.all(pair.map(async v=>{
        if(Math.abs(v.currentTime-target)>.25/clip.fps)v.currentTime=target;
        await wait(v,"seeked",()=>!v.seeking,signal);
      }));
      if(signal.aborted)return;
      loaded=true;clock();status.hidden=true;
      if(start){
        if(pair.some(v=>v.paused))throw Error("Paired playback interrupted");
      }
      busy=false;tick();
    }catch(e){
      if(signal.aborted)return;
      attempt.abort();busy=false;wanted=false;failed=e.name!=="NotAllowedError";stop();
      const mediaError=pair.find(v=>v.error)?.error;
      notice(!failed?"Tap Play to start the comparison.":mediaError?.code===2?"Network interrupted. Tap Play to retry.":
        mediaError?.code===3||mediaError?.code===4?"This browser could not decode the video.":"Comparison interrupted. Tap Play to retry.",true);
    }finally{clearTimeout(later);clearTimeout(slow);}
  }
  modes.forEach(b=>b.onclick=()=>{if(mode!==b.dataset.output||failed){mode=b.dataset.output;update();}});
  quality.onchange=()=>update();
  play.onclick=()=>{
    if(play.classList.contains("playing")||(wanted&&pair.every(v=>!v.paused&&v.readyState>=2))){
      wanted=false;run?.abort();busy=false;stop();notice("");return;
    }
    wanted=true;update();
  };
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
    v.addEventListener("waiting",()=>{if(!busy&&wanted&&visible&&!v.seeking)notice("Buffering…");});
    v.addEventListener("playing",()=>{if(!busy&&wanted&&pair.every(el=>!el.paused&&el.readyState>=3))notice("");});
    v.addEventListener("error",()=>{
      if(busy||!visible||!v.error)return;
      wanted=false;failed=true;stop();notice(v.error.code===2?"Network interrupted. Tap Play to retry.":"Playback failed. Tap Play to retry.",true);
    });
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
