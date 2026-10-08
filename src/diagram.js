(function (root) {
  'use strict';
  const COLORS = ['#64d8bd', '#eabe75', '#9fa6ff', '#f38fac', '#79bcf2', '#c2dd87'];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]));
  function layout(term, redexPath = null) {
    const lines = [], labels = [], binders = [], leaves = []; let leaf = 0;
    const samePath = (a,b) => b !== null && a.length === b.length && a.every((x,i)=>x===b[i]);
    function draw(t, top, env, path) {
      const start = leaf;
      if (t.type === 'var') {
        const x = leaf++ * 40 + 50, end = top + 32;
        const binder = [...env].reverse().find(b=>b.name === t.name);
        const line = { kind:'variable', x1:x, x2:x, y1:binder ? binder.y : 30, y2:end,
          color:binder ? binder.color : '#aeb9ce', free:!binder, name:t.name, binder:binder ? binder.id : null, path };
        lines.push(line); leaves.push(line);
        if (!binder) labels.push({ x, y:19, text:t.name, free:true });
        return { left:x, right:x, bottom:end, start, end:leaf };
      }
      if (t.type === 'abs') {
        const binder = { id:binders.length, name:t.param, y:top, color:COLORS[binders.length % COLORS.length] };
        binders.push(binder);
        const body = draw(t.body, top+32, [...env,binder], [...path,'body']);
        const active = redexPath && samePath(path,[...redexPath,'fn']);
        lines.push({ kind:'abstraction', x1:body.left-15, x2:body.right+15, y1:top, y2:top, color:binder.color, binder:binder.id, name:t.param, active });
        return { ...body };
      }
      const left = draw(t.fn, top, env, [...path,'fn']);
      const right = draw(t.arg, top, env, [...path,'arg']);
      const bottom = Math.max(left.bottom, right.bottom) + 32;
      lines.push({ kind:'extension', x1:left.left, x2:left.left, y1:left.bottom, y2:bottom, color:leaves[left.start].color });
      lines.push({ kind:'extension', x1:right.left, x2:right.left, y1:right.bottom, y2:bottom, color:leaves[right.start].color });
      lines.push({ kind:'application', x1:left.left, x2:right.left, y1:bottom, y2:bottom, color:'#d5dff1', active:samePath(path,redexPath), path });
      return { left:left.left, right:right.right, bottom, start, end:leaf };
    }
    const tree = draw(term, 64, [], []);
    return { lines, labels, binders, leaves, width:Math.max(140, leaf*40+60), height:tree.bottom+48 };
  }
  function svg(term, redexPath = null, options = {}) {
    const model = layout(term, redexPath), { width, height } = model;
    const backgrounds = options.export ? `<rect width="100%" height="100%" fill="#131c2d"/>` : '';
    const shapes = model.lines.map(l => `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${l.active ? '#ff91b7' : l.color}" stroke-width="${l.active ? 5 : 3}" stroke-linecap="square" ${l.free ? 'stroke-dasharray="5 5"' : ''} data-kind="${l.kind}" ${l.active ? 'data-active="true"' : ''}><title>${esc(l.kind==='abstraction' ? `λ${l.name}：绑定横线` : l.kind==='variable' ? `${l.name}：${l.free?'自由变量':`连接绑定 λ${l.name}`}` : l.kind==='application' ? '函数应用：连接左右子项最左变量' : '延伸到外层应用')}</title></line>`).join('');
    const labels = model.labels.map(l=>`<text x="${l.x}" y="${l.y}" text-anchor="middle" fill="#bac5d8" font-size="12" font-family="monospace">${esc(l.text)}</text>`).join('');
    return { model, markup:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="John Tromp Lambda 图示"><title>John Tromp Lambda 图示</title>${backgrounds}${shapes}${labels}</svg>` };
  }
  const API = { layout, svg, COLORS };
  root.LambdaDiagram = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : window);
