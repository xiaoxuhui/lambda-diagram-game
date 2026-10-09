(function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg',D=root.LambdaDiagram;
  function init(mount){
    let svg=null,model=null;const lines=[],labels=[];
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
    }
    function clear(){mount.replaceChildren();svg=null;model=null;lines.length=0;labels.length=0;}
    return {render,clear};
  }
  root.LambdaDiagramView={init};
})(typeof globalThis!=='undefined'?globalThis:window);
