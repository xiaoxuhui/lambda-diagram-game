(function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg',D=root.LambdaDiagram;
  const coordinates=['x1','x2','y1','y2'],dash=[5,5],solid=[];
  const stroke=line=>line.active?'#ff91b7':line.color;
  function init(mount){
    let svg=null,model=null,hitLayer=null,motion=null,previous=null,frameRequest=null,enabled=true;const lines=[],labels=[],hits=[];
    let wireMotion=null;
    const viewport=mount.parentElement;
    const reducedMotion=root.matchMedia('(prefers-reduced-motion: reduce)');
    const element=name=>document.createElementNS(NS,name);
    const hitShape=line=>`M ${line.x1} ${line.y1-3} H ${line.x2} V ${line.y1+3} H ${line.x1} Z`;
    function attribute(node,name,value,previous){if(value!==previous){if(value===null)node.removeAttribute(name);else node.setAttribute(name,String(value));}}
    function cancelTransition(){
      motion?.cancel();motion=null;
      if(frameRequest!==null){root.cancelAnimationFrame(frameRequest);frameRequest=null;}
      wireMotion=null;
      previous?.remove();previous=null;
      svg?.style.removeProperty('opacity');
    }
    function placement(){
      const matrix=svg.getScreenCTM(),box=viewport.getBoundingClientRect();
      return matrix&&{x:matrix.e-box.left-viewport.clientLeft,y:matrix.f-box.top-viewport.clientTop,scale:matrix.a};
    }
    function captureFrame(){
      if(!svg||reducedMotion.matches||!viewport.clientWidth||!viewport.clientHeight)return null;
      return {model,placement:placement(),wireMotion};
    }
    function makeOverlay(className){
      const overlay=document.createElement('div');
      overlay.className=className;
      overlay.setAttribute('aria-hidden','true');
      Object.assign(overlay.style,{left:viewport.scrollLeft+'px',top:viewport.scrollTop+'px',
        width:viewport.clientWidth+'px',height:viewport.clientHeight+'px'});
      return overlay;
    }
    function overlayContext(overlay,width,height){
      const canvas=document.createElement('canvas'),pixelRatio=root.devicePixelRatio||1;
      canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);
      canvas.style.width=width+'px';canvas.style.height=height+'px';
      const context=canvas.getContext('2d');
      if(!context)return null;
      context.scale(pixelRatio,pixelRatio);
      overlay.append(canvas);
      return context;
    }
    function drawStroke(context,line,opacity){
      context.globalAlpha=opacity;context.strokeStyle=stroke(line);
      context.setLineDash(line.free?dash:solid);
      context.stroke();
    }
    function transitionFrom(frame,duration,change,reverse=false){
      if(!frame?.placement)return;
      if(change){animateReduction(frame,duration,change,reverse);return;}
      const overlay=makeOverlay('diagram-previous');
      const width=viewport.clientWidth,height=viewport.clientHeight,context=overlayContext(overlay,width,height);
      if(!context)return;
      const {x,y,scale}=frame.placement;
      const left=-x/scale,top=-y/scale,right=(width-x)/scale,bottom=(height-y)/scale;
      context.translate(x,y);context.scale(scale,scale);context.lineCap='square';
      for(const line of frame.model.lines){
        if(line.x2+3<left||line.x1-3>right||line.y2+3<top||line.y1-3>bottom)continue;
        context.beginPath();context.moveTo(line.x1,line.y1);context.lineTo(line.x2,line.y2);
        context.lineWidth=line.active?5:3;drawStroke(context,line,1);
      }
      context.font='10px monospace';context.textAlign='center';context.fillStyle='#bac5d8';
      for(const label of frame.model.labels)context.fillText(label.text,label.x,label.y);
      viewport.append(overlay);previous=overlay;
      const options={duration,easing:'cubic-bezier(.22,.75,.24,1)'};
      motion=svg.animate([{opacity:.2},{opacity:1}],options);
      overlay.animate([{opacity:1},{opacity:0}],options).onfinish=()=>{
        overlay.remove();
        if(previous===overlay)previous=null;
      };
    }
    function animateReduction(frame,duration,change,reverse){
      const target=placement();
      if(!frame.placement||!target)return;
      const overlay=makeOverlay('diagram-wire-motion');
      const width=viewport.clientWidth,height=viewport.clientHeight,context=overlayContext(overlay,width,height);
      if(!context)return;
      const before=reverse?model:frame.model,after=reverse?frame.model:model;
      const beforePlacement=reverse?target:frame.placement,afterPlacement=reverse?frame.placement:target;
      const {lineOrigins,labelOrigins}=D.reductionOrigins(before,after,change);
      const wires=tracks(before.lines,after.lines,lineOrigins);
      const names=tracks(before.labels,after.labels,labelOrigins);
      const interrupted=frame.wireMotion;
      const initial=interrupted?.change===change&&interrupted.reverse!==reverse
        ?interrupted.progress:reverse?1:0;
      const end=reverse?0:1;
      const time=duration*Math.abs(end-initial);
      if(!time)return;
      wireMotion={change,reverse,progress:initial};
      const mix=(a,b,t)=>a+(b-a)*t;
      function paint(progress){
        wireMotion.progress=progress;
        context.clearRect(0,0,width,height);
        const x=mix(beforePlacement.x,afterPlacement.x,progress),y=mix(beforePlacement.y,afterPlacement.y,progress);
        const scale=mix(beforePlacement.scale,afterPlacement.scale,progress);
        const left=-x/scale,top=-y/scale,right=(width-x)/scale,bottom=(height-y)/scale;
        context.save();context.translate(x,y);context.scale(scale,scale);context.lineCap='square';
        for(const {from,to} of wires){
          const start=from??to,end=to??from;
          const x1=mix(start.x1,end.x1,progress),x2=mix(start.x2,end.x2,progress);
          const y1=mix(start.y1,end.y1,progress),y2=mix(start.y2,end.y2,progress);
          if(x2+3<left||x1-3>right||y2+3<top||y1-3>bottom)continue;
          context.beginPath();
          context.moveTo(x1,y1);
          context.lineTo(x2,y2);
          context.lineWidth=mix(start.active?5:3,end.active?5:3,progress);
          if(from&&to&&stroke(from)===stroke(to)&&from.free===to.free){
            drawStroke(context,from,1);
          }else{
            if(from)drawStroke(context,from,1-progress);
            if(to)drawStroke(context,to,progress);
          }
        }
        context.font='10px monospace';context.textAlign='center';context.fillStyle='#bac5d8';
        for(const {from,to} of names){
          const start=from??to,end=to??from;
          const x=mix(start.x,end.x,progress),y=mix(start.y,end.y,progress);
          if(from&&to&&from.text===to.text){context.globalAlpha=1;context.fillText(to.text,x,y);}
          else{
            if(from){context.globalAlpha=1-progress;context.fillText(from.text,x,y);}
            if(to){context.globalAlpha=progress;context.fillText(to.text,x,y);}
          }
        }
        context.restore();
      }
      viewport.append(overlay);previous=overlay;svg.style.opacity='0';
      paint(initial);
      const start=performance.now();
      function tick(now){
        const progress=Math.min(1,Math.max(0,(now-start)/time));
        if(progress===1){cancelTransition();return;}
        paint(mix(initial,end,progress*progress*(3-2*progress)));
        frameRequest=root.requestAnimationFrame(tick);
      }
      frameRequest=root.requestAnimationFrame(tick);
    }
    function tracks(before,after,origins){
      const matched=new Set(origins);
      const result=after.map((to,index)=>({from:before[origins[index]],to}));
      for(let i=0;i<before.length;i++)if(!matched.has(i))result.push({from:before[i],to:null});
      return result;
    }
    function render(next){
      cancelTransition();
      if(!svg){svg=element('svg');svg.setAttribute('xmlns',NS);svg.setAttribute('role','group');svg.setAttribute('aria-label','John Tromp Lambda 图示，可点击顶部横条归约');
        const title=element('title');title.textContent='John Tromp Lambda 图示';hitLayer=element('g');svg.append(title,hitLayer);mount.replaceChildren(svg);}
      attribute(svg,'viewBox',`0 0 ${next.width} ${next.height}`,model?`0 0 ${model.width} ${model.height}`:undefined);
      const newLines=document.createDocumentFragment();
      for(let i=0;i<next.lines.length;i++){
        const line=next.lines[i],old=model?.lines[i];let node=lines[i];
        if(!node){node=element('line');node.append(element('title'));node.setAttribute('stroke-linecap','square');lines.push(node);newLines.append(node);}
        for(const key of coordinates)attribute(node,key,line[key],old?.[key]);
        attribute(node,'stroke',line.active?'#ff91b7':line.color,old?(old.active?'#ff91b7':old.color):undefined);
        attribute(node,'stroke-width',line.active?5:3,old?(old.active?5:3):undefined);
        attribute(node,'stroke-dasharray',line.free?'5 5':null,old?(old.free?'5 5':null):undefined);
        attribute(node,'data-kind',line.kind,old?.kind);attribute(node,'data-active',line.active?'true':null,old?(old.active?'true':null):undefined);
        if(!old||line.kind!==old.kind||line.name!==old.name||line.free!==old.free)node.firstElementChild.textContent=D.lineTitle(line);
      }
      while(lines.length>next.lines.length)lines.pop().remove();
      if(newLines.firstChild)svg.insertBefore(newLines,labels[0]||hitLayer);
      const newLabels=document.createDocumentFragment();
      for(let i=0;i<next.labels.length;i++){
        const label=next.labels[i],old=model?.labels[i];let node=labels[i];
        if(!node){node=element('text');node.setAttribute('text-anchor','middle');node.setAttribute('fill','#bac5d8');node.setAttribute('font-size','10');node.setAttribute('font-family','monospace');
          node.append(element('title'),document.createTextNode(''));labels.push(node);newLabels.append(node);}
        attribute(node,'x',label.x,old?.x);attribute(node,'y',label.y,old?.y);
        if(!old||label.text!==old.text){node.firstElementChild.textContent=label.text;node.lastChild.nodeValue=label.text;}
      }
      while(labels.length>next.labels.length)labels.pop().remove();
      if(newLabels.firstChild)svg.insertBefore(newLabels,hitLayer);
      model=next;
      const newHits=document.createDocumentFragment();let hitCount=0;
      for(const line of next.lines){
        if(!Object.prototype.hasOwnProperty.call(line,'redexPath'))continue;
        let hit=hits[hitCount++];
        if(!hit){hit=element('path');hit.setAttribute('data-redex-hit','true');hit.setAttribute('role','button');hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','18');hit.setAttribute('vector-effect','non-scaling-stroke');hit.setAttribute('fill','transparent');hit.append(element('title'));hits.push(hit);newHits.append(hit);hit.setAttribute('tabindex',enabled?'0':'-1');hit.setAttribute('aria-disabled',String(!enabled));hit.style.pointerEvents=enabled?'all':'none';}
        const old=hit.reductionLine;
        attribute(hit,'d',hitShape(line),old?hitShape(old):undefined);
        if(!old||old.name!==line.name){const label=`点击 λ${line.name} 顶部横条，归约这一项`;hit.setAttribute('aria-label',label);hit.firstElementChild.textContent=label;}
        hit.reductionLine=line;
      }
      while(hits.length>hitCount)hits.pop().remove();
      if(newHits.firstChild)hitLayer.append(newHits);
    }
    function setEnabled(value){if(enabled===value)return;enabled=value;for(const hit of hits){hit.setAttribute('tabindex',enabled?'0':'-1');hit.setAttribute('aria-disabled',String(!enabled));hit.style.pointerEvents=enabled?'all':'none';}}
    function selection(target){const hit=target.closest?.('[data-redex-hit]');return enabled&&hit&&mount.contains(hit)?{path:hit.reductionLine.redexPath}:null;}
    function clear(){cancelTransition();mount.replaceChildren();svg=null;hitLayer=null;model=null;lines.length=0;labels.length=0;hits.length=0;}
    return {render,clear,setEnabled,selection,captureFrame,transitionFrom,cancelTransition};
  }
  root.LambdaDiagramView={init};
})(typeof globalThis!=='undefined'?globalThis:window);
