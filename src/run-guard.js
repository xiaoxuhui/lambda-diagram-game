(function(root){
  'use strict';
  const DEFAULT_MS=1000;
  const message='计算在观察窗口内仍持续增长，已保护性暂停，尚未确认是否会终止。请检查是否漏传函数参数；可以继续或取消。';
  const waitingMessage='快速求值已达到本次等待时长，仍未完成，已暂停；尚未确认是否会终止。可以继续求值或取消。';
  function create({windowMs=DEFAULT_MS,now=()=>performance.now(),initial=0,requireGrowth=true}={}){
    let started=now(),baseline=initial;
    const reset=size=>{started=now();baseline=size;};
    return {reset,check(size){
      const duration=typeof windowMs==='function'?windowMs():windowMs;
      if(!duration){reset(size);return false;}
      if(now()-started<duration)return false;
      const shouldPause=!requireGrowth||size>baseline;reset(size);return shouldPause;
    }};
  }
  const API={DEFAULT_MS,message,waitingMessage,create};root.LambdaRunGuard=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
