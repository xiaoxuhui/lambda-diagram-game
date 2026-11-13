(function(root){
  'use strict';
  const TAP_SLOP=20;
  function init(api) {
    const viewport=document.getElementById('diagram-viewport');
    const svg=()=>document.querySelector('#diagram-mount svg');
    const reducedMotion=root.matchMedia('(prefers-reduced-motion: reduce)');
    const points=new Map();let gesture=null,tap=null;
    let zoomFrame=null,zoomTarget=null;
    function anchor(point) {
      if(!svg())return null;
      const box=viewport.getBoundingClientRect(),image=svg().getBoundingClientRect();
      const client=point||{x:box.left+viewport.clientWidth/2,y:box.top+viewport.clientHeight/2};
      return {client,x:(client.x-image.left)/api.getScale(),y:(client.y-image.top)/api.getScale()};
    }
    function restore(a) {
      if(!a||!svg())return;
      const image=svg().getBoundingClientRect();
      viewport.scrollLeft+=image.left+a.x*api.getScale()-a.client.x;
      viewport.scrollTop+=image.top+a.y*api.getScale()-a.client.y;
    }
    function cancelZoom() {
      if(zoomFrame!==null)root.cancelAnimationFrame(zoomFrame);
      zoomFrame=null;zoomTarget=null;
    }
    function zoomTo(scale,point,smooth=true) {
      if(!api.canInteract())return;
      cancelZoom();
      const a=anchor(point),start=api.getScale(),target=Math.max(.02,Math.min(16,scale));
      function apply(value){api.setScale(value);restore(a);api.onChange();}
      if(!smooth||reducedMotion.matches||start===target){apply(target);return;}
      zoomTarget=target;
      apply(start);
      const began=performance.now(),ratio=target/start;
      function frame(now){
        const progress=Math.min(1,Math.max(0,(now-began)/150));
        apply(progress===1?target:start*ratio**(1-(1-progress)**3));
        if(progress===1)cancelZoom();else zoomFrame=root.requestAnimationFrame(frame);
      }
      zoomFrame=root.requestAnimationFrame(frame);
    }
    const desiredScale=()=>zoomTarget??api.getScale();
    document.getElementById('zoom-in').addEventListener('click',()=>zoomTo(desiredScale()*1.25));
    document.getElementById('zoom-out').addEventListener('click',()=>zoomTo(desiredScale()/1.25));
    document.getElementById('actual-size').addEventListener('click',()=>zoomTo(1));
    document.getElementById('fit').addEventListener('click',()=>{if(!api.canInteract())return;cancelZoom();api.fit();viewport.scrollLeft=0;viewport.scrollTop=0;api.onChange();});
    viewport.addEventListener('wheel',e=>{
      if(!api.canInteract()||!e.deltaY)return;
      e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?viewport.clientHeight:1;
      const delta=Math.max(-1000,Math.min(1000,e.deltaY*unit));zoomTo(desiredScale()*Math.exp(-delta*.002),{x:e.clientX,y:e.clientY},!points.size);
    },{passive:false});
    function startGesture() {
      const p=[...points.values()];
      gesture=p.length>1?{type:'pinch',distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}:p.length?{type:'pan',...p[0]}:null;
      viewport.classList.toggle('dragging',!!gesture);
    }
    viewport.addEventListener('pointerdown',e=>{
      if(!api.canInteract()||(e.pointerType==='mouse'&&e.button!==0))return;
      cancelZoom();
      e.preventDefault();tap=points.size?null:{id:e.pointerId,x:e.clientX,y:e.clientY,selection:api.captureTap?.(e.target)};
      points.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);viewport.focus({preventScroll:true});startGesture();
    });
    viewport.addEventListener('pointermove',e=>{
      if(!points.has(e.pointerId)||!gesture)return;
      if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>TAP_SLOP)tap=null;
      e.preventDefault();points.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=[...points.values()];
      if(p.length>1) {
        const x=(p[0].x+p[1].x)/2,y=(p[0].y+p[1].y)/2,distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
        viewport.scrollLeft-=x-gesture.x;viewport.scrollTop-=y-gesture.y;
        if(gesture.distance>0&&distance>0)zoomTo(api.getScale()*distance/gesture.distance,{x,y},false);
        gesture={type:'pinch',distance,x,y};
      }else{
        if(!gesture.moved&&Math.hypot(p[0].x-gesture.x,p[0].y-gesture.y)<=TAP_SLOP)return;
        viewport.scrollLeft-=p[0].x-gesture.x;viewport.scrollTop-=p[0].y-gesture.y;gesture={type:'pan',...p[0],moved:true};api.onChange();
      }
    });
    function end(e){points.delete(e.pointerId);if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);startGesture();}
    viewport.addEventListener('pointerup',e=>{const selected=tap&&tap.id===e.pointerId&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<=TAP_SLOP?tap.selection:null;tap=null;end(e);if(selected)api.onTap?.(selected);});
    viewport.addEventListener('pointercancel',e=>{tap=null;end(e);});
    viewport.addEventListener('lostpointercapture',e=>{tap=null;points.delete(e.pointerId);startGesture();});
    viewport.addEventListener('scroll',api.onChange,{passive:true});
    viewport.addEventListener('keydown',e=>{
      if(!api.canInteract())return;
      if(['+','=','-','0'].includes(e.key)){e.preventDefault();zoomTo(e.key==='0'?1:desiredScale()*(e.key==='-'?.8:1.25));}
    });
    return {anchor,restore,zoomTo,cancelZoom};
  }
  root.LambdaViewport={init};
})(typeof globalThis!=='undefined'?globalThis:window);
