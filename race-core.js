(function(root){
 'use strict';
 function progress(elapsed,rate,total,sourceFps){
   const frames=Math.min(total,Math.max(0,Math.floor(elapsed*rate)));
   return {frames,frameIndex:Math.max(0,frames-1),time:Math.max(0,frames-1)/sourceFps,complete:frames===total};
 }
 const core={progress};if(typeof module!=='undefined'&&module.exports)module.exports=core;
 if(root)root.RaceCore=core;
})(typeof window==='undefined'?null:window);
