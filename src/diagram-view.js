(function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg',D=root.LambdaDiagram;
  function init(mount){
    let svg=null,model=null,enabled=true;const lines=[],labels=[],hits=[];
    const element=name=>document.createElementNS(NS,name);
    function attribute(node,name,value,previous){if(value!==previous){if(value===null)node.removeAttribute(name);else node.setAttribute(name,String(value));}}
    function render(next){
      if(!svg){svg=element('svg');svg.setAttribute('xmlns',NS);svg.setAttribute('role','img');svg.setAttribute('aria-label','John Tromp Lambda 图示');
        const title=element('title');title.textContent='John Tromp Lambda 图示';svg.append(title);mount.replaceChildren(svg);}
      attribute(svg,'viewBox',`0 0 ${next.width} ${next.height}`,model?`0 0 ${model.width} ${model.height}`:undefined);
      const newLines=document.createDocumentFragment();
      for(let i=0;i<next.lines.length;i++){
        const line=next.lines[i],old=model?.lines[i];let node=lines[i];
        if(!node){node=element('line');node.append(element('title'));node.setAttribute('stroke-linecap','square');lines.push(node);newLines.append(node);}
        for(const key of ['x1','x2','y1','y2'])attribute(node,key,line[key],old?.[key]);
        attribute(node,'stroke',line.active?'#ff91b7':line.color,old?(old.active?'#ff91b7':old.color):undefined);
        attribute(node,'stroke-width',line.active?5:3,old?(old.active?5:3):undefined);
        attribute(node,'stroke-dasharray',line.free?'5 5':null,old?(old.free?'5 5':null):undefined);
        attribute(node,'data-kind',line.kind,old?.kind);attribute(node,'data-active',line.active?'true':null,old?(old.active?'true':null):undefined);
        const title=D.lineTitle(line);if(!old||title!==D.lineTitle(old))node.firstElementChild.textContent=title;
      }
      while(lines.length>next.lines.length)lines.pop().remove();
      svg.insertBefore(newLines,labels[0]||null);
      const newLabels=document.createDocumentFragment();
      for(let i=0;i<next.labels.length;i++){
        const label=next.labels[i],old=model?.labels[i];let node=labels[i];
        if(!node){node=element('text');node.setAttribute('text-anchor','middle');node.setAttribute('fill','#bac5d8');node.setAttribute('font-size','10');node.setAttribute('font-family','monospace');
          node.append(element('title'),document.createTextNode(''));labels.push(node);newLabels.append(node);}
        attribute(node,'x',label.x,old?.x);attribute(node,'y',label.y,old?.y);
        if(!old||label.text!==old.text){node.firstElementChild.textContent=label.text;node.lastChild.nodeValue=label.text;}
      }
      while(labels.length>next.labels.length)labels.pop().remove();svg.append(newLabels);model=next;
      const newHits=document.createDocumentFragment();let hitCount=0;
      for(const line of next.lines){
        if(!Object.prototype.hasOwnProperty.call(line,'redexPath'))continue;
        let hit=hits[hitCount++];
        if(!hit){hit=element('path');hit.setAttribute('data-redex-hit','true');hit.setAttribute('role','button');hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','18');hit.setAttribute('vector-effect','non-scaling-stroke');hit.setAttribute('fill','none');hit.append(element('title'));hits.push(hit);newHits.append(hit);}
        const old=hit.reductionLine;
        attribute(hit,'d',`M ${line.x1} ${line.y1} H ${line.x2}`,old?`M ${old.x1} ${old.y1} H ${old.x2}`:undefined);
        if(!old||old.name!==line.name){const label=`点击 λ${line.name} 顶部横条，归约这一项`;hit.setAttribute('aria-label',label);hit.firstElementChild.textContent=label;}
        hit.reductionLine=line;hit.setAttribute('tabindex',enabled?'0':'-1');hit.setAttribute('aria-disabled',String(!enabled));hit.style.pointerEvents=enabled?'stroke':'none';
      }
      while(hits.length>hitCount)hits.pop().remove();svg.append(newHits);
    }
    function setEnabled(value){if(enabled===value)return;enabled=value;for(const hit of hits){hit.setAttribute('tabindex',enabled?'0':'-1');hit.setAttribute('aria-disabled',String(!enabled));hit.style.pointerEvents=enabled?'stroke':'none';}}
    function selection(target){const hit=target.closest?.('[data-redex-hit]');return enabled&&hit&&mount.contains(hit)?{path:hit.reductionLine.redexPath}:null;}
    function clear(){mount.replaceChildren();svg=null;model=null;lines.length=0;labels.length=0;hits.length=0;}
    return {render,clear,setEnabled,selection};
  }
  root.LambdaDiagramView={init};
})(typeof globalThis!=='undefined'?globalThis:window);
