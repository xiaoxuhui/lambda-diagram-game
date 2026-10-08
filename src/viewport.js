(function(root){
  'use strict';
  function init(api) {
    const viewport=document.getElementById('diagram-viewport');
    const svg=()=>document.querySelector('#diagram-mount svg');
    const points=new Map();let gesture=null;
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
    function zoomTo(scale,point) {
      if(!api.canInteract())return;
      const a=anchor(point);api.setScale(Math.max(.02,Math.min(16,scale)));restore(a);api.onChange();
    }
    document.getElementById('zoom-in').addEventListener('click',()=>zoomTo(api.getScale()*1.25));
    document.getElementById('zoom-out').addEventListener('click',()=>zoomTo(api.getScale()/1.25));
    document.getElementById('actual-size').addEventListener('click',()=>zoomTo(1));
    document.getElementById('fit').addEventListener('click',()=>{if(!api.canInteract())return;api.fit();viewport.scrollLeft=0;viewport.scrollTop=0;api.onChange();});
    viewport.addEventListener('wheel',e=>{
      if(!api.canInteract()||!e.deltaY)return;
      e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?viewport.clientHeight:1;
      const delta=Math.max(-1000,Math.min(1000,e.deltaY*unit));zoomTo(api.getScale()*Math.exp(-delta*.002),{x:e.clientX,y:e.clientY});
    },{passive:false});
    function startGesture() {
      const p=[...points.values()];
      gesture=p.length>1?{type:'pinch',distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}:p.length?{type:'pan',...p[0]}:null;
      viewport.classList.toggle('dragging',!!gesture);
    }
    viewport.addEventListener('pointerdown',e=>{
      if(!api.canInteract()||(e.pointerType==='mouse'&&e.button!==0))return;
      e.preventDefault();points.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);viewport.focus({preventScroll:true});startGesture();
    });
    viewport.addEventListener('pointermove',e=>{
      if(!points.has(e.pointerId)||!gesture)return;
      e.preventDefault();points.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=[...points.values()];
      if(p.length>1) {
        const x=(p[0].x+p[1].x)/2,y=(p[0].y+p[1].y)/2,distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
        viewport.scrollLeft-=x-gesture.x;viewport.scrollTop-=y-gesture.y;
        if(gesture.distance>0&&distance>0)zoomTo(api.getScale()*distance/gesture.distance,{x,y});
        gesture={type:'pinch',distance,x,y};
      }else{viewport.scrollLeft-=p[0].x-gesture.x;viewport.scrollTop-=p[0].y-gesture.y;gesture={type:'pan',...p[0]};api.onChange();}
    });
    function end(e){points.delete(e.pointerId);if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);startGesture();}
    viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
    viewport.addEventListener('lostpointercapture',e=>{points.delete(e.pointerId);startGesture();});
    viewport.addEventListener('scroll',api.onChange,{passive:true});
    viewport.addEventListener('keydown',e=>{
      if(!api.canInteract())return;
      if(['+','=','-','0'].includes(e.key)){e.preventDefault();zoomTo(e.key==='0'?1:api.getScale()*(e.key==='-'?.8:1.25));}
    });
    return {anchor,restore,zoomTo};
  }
  root.LambdaViewport={init};
})(typeof globalThis!=='undefined'?globalThis:window);
