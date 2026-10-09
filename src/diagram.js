(function (root) {
  'use strict';
  const COLORS = ['#64d8bd', '#eabe75', '#9fa6ff', '#f38fac', '#79bcf2', '#c2dd87'];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]));
  const lineTitle=l=>l.kind==='abstraction'?`λ${l.name}：绑定横线`:l.kind==='variable'?`${l.name}：${l.free?'自由变量':`连接绑定 λ${l.name}`}`:l.kind==='application'?'函数应用：连接左右子项最左变量':'延伸到外层应用';
  function layout(term, redexPath = null) {
    const lines = [], labels = [], binders = [], leaves = []; let leaf = 0;
    const env=new Map(),origin={parent:null,part:null,length:0,matches:true};let tree;
    const child=(parent,part)=>({parent,part,length:parent.length+1,matches:redexPath!==null&&parent.matches&&redexPath[parent.length]===part});
    function withPath(line,route){
      Object.defineProperty(line,'path',{enumerable:true,configurable:true,get(){
        const path=Array(route.length);for(let i=path.length-1;i>=0;i--){path[i]=route.part;route=route.parent;}
        Object.defineProperty(line,'path',{value:path,enumerable:true});return path;
      }});return line;
    }
    const stack=[{t:term,top:64,route:origin}];
    while(stack.length){
      const entry=stack.pop(),{t,top,route}=entry;
      if(entry.stage==='abs'){
        env.get(t.param).pop();const binder=entry.binder;
        const active=redexPath&&route.part==='fn'&&route.parent.length===redexPath.length&&route.parent.matches;
        lines.push({kind:'abstraction',x1:tree.left-15,x2:tree.right+15,y1:top,y2:top,color:binder.color,binder:binder.id,name:t.param,active});continue;
      }
      if(entry.stage==='left'){
        stack.push({...entry,stage:'right',left:tree},{t:t.arg,top,route:child(route,'arg')});continue;
      }
      if(entry.stage==='right'){
        const left=entry.left,right=tree,bottom=Math.max(left.bottom,right.bottom)+32;
        lines.push({kind:'extension',x1:left.left,x2:left.left,y1:left.bottom,y2:bottom,color:leaves[left.start].color});
        lines.push({kind:'extension',x1:right.left,x2:right.left,y1:right.bottom,y2:bottom,color:leaves[right.start].color});
        lines.push(withPath({kind:'application',x1:left.left,x2:right.left,y1:bottom,y2:bottom,color:'#d5dff1',active:redexPath!==null&&route.matches&&route.length===redexPath.length},route));
        tree={left:left.left,right:right.right,bottom,start:entry.start,end:leaf};continue;
      }
      const start=leaf;
      if(t.type==='var'){
        const x = leaf++ * 40 + 50, end = top + 32;
        const binder=env.get(t.name)?.at(-1);
        const line = withPath({ kind:'variable', x1:x, x2:x, y1:binder ? binder.y : 30, y2:end,
          color:binder ? binder.color : '#aeb9ce', free:!binder, name:t.name, binder:binder ? binder.id : null },route);
        lines.push(line); leaves.push(line);
        if (!binder) labels.push({ x, y:19, text:t.name, free:true });
        tree={left:x,right:x,bottom:end,start,end:leaf};continue;
      }else if(t.type==='abs'){
        const binder = { id:binders.length, name:t.param, y:top, color:COLORS[binders.length % COLORS.length] };
        binders.push(binder);
        const scope=env.get(t.param)||[];scope.push(binder);env.set(t.param,scope);
        stack.push({...entry,stage:'abs',binder},{t:t.body,top:top+32,route:child(route,'body')});
      }else stack.push({...entry,stage:'left',start},{t:t.fn,top,route:child(route,'fn')});
    }
    return { lines, labels, binders, leaves, width:Math.max(140, leaf*40+60), height:tree.bottom+48 };
  }
  function svg(term, redexPath = null, options = {}) {
    const model = layout(term, redexPath), { width, height } = model;
    const backgrounds = options.export ? `<rect width="100%" height="100%" fill="#131c2d"/>` : '';
    const shapes = model.lines.map(l => `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${l.active ? '#ff91b7' : l.color}" stroke-width="${l.active ? 5 : 3}" stroke-linecap="square" ${l.free ? 'stroke-dasharray="5 5"' : ''} data-kind="${l.kind}" ${l.active ? 'data-active="true"' : ''}><title>${esc(l.kind==='abstraction' ? `λ${l.name}：绑定横线` : l.kind==='variable' ? `${l.name}：${l.free?'自由变量':`连接绑定 λ${l.name}`}` : l.kind==='application' ? '函数应用：连接左右子项最左变量' : '延伸到外层应用')}</title></line>`).join('');
    const labels = model.labels.map(l=>`<text x="${l.x}" y="${l.y}" text-anchor="middle" fill="#bac5d8" font-size="10" font-family="monospace"><title>${esc(l.text)}</title>${esc(l.text)}</text>`).join('');
    return { model, markup:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="John Tromp Lambda 图示"><title>John Tromp Lambda 图示</title>${backgrounds}${shapes}${labels}</svg>` };
  }
  const API = { layout, svg, COLORS, lineTitle };
  root.LambdaDiagram = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : window);
