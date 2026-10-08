const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');
const D = require('../src/diagram.js');
const P = require('../src/presets.js');
const model = s => D.layout(C.parse(s));
test('large numeral emits every line without compression',()=>{const m=D.svg(C.parse('1024'));assert.equal(m.model.leaves.length,1025);assert.equal(m.model.lines.length,4099);assert.equal((m.markup.match(/<line /g)||[]).length,4099);});
test('long free-variable labels stay complete',()=>assert.ok(D.svg(C.parse('variableName')).markup.includes('>variableName</text>')));
test('identity has one horizontal binder and one bound wire', () => {
  const m=model('λx.x'); assert.equal(m.binders.length,1); assert.equal(m.leaves.length,1);
  assert.equal(m.leaves[0].y1,m.binders[0].y); assert.equal(m.leaves[0].binder,0);
  assert.equal(m.lines.filter(l=>l.kind==='application').length,0);
});
test('K binds its wire to the first lambda, not the nearest line', () => {
  const m=model('λx.λy.x'); assert.equal(m.binders.length,2); assert.equal(m.leaves[0].binder,0);
});
test('false binds its wire to the second lambda', () => assert.equal(model('λx.λy.y').leaves[0].binder,1));
test('shadowing chooses nearest matching binder', () => assert.equal(model('λx.λx.x').leaves[0].binder,1));
test('Church 2 has three wires and two leftmost application links', () => {
  const m=model('λf.λx.f (f x)'), apps=m.lines.filter(l=>l.kind==='application');
  assert.deepEqual(m.leaves.map(l=>l.binder),[0,0,1]); assert.equal(apps.length,2);
  assert.deepEqual(apps.map(l=>[l.x1,l.x2]),[[90,130],[50,90]]);
  assert.ok(apps[1].y1>apps[0].y1);
});
test('S has four variables and three applications', () => {
  const m=model('λx y z.(x z)(y z)'); assert.equal(m.leaves.length,4);
  assert.equal(m.lines.filter(l=>l.kind==='application').length,3);
  assert.deepEqual(m.leaves.map(l=>l.binder),[0,2,1,2]);
});
test('Omega contains two independent binders', () => {
  const m=model('(λx.x x)(λx.x x)'); assert.deepEqual(m.leaves.map(l=>l.binder),[0,0,1,1]);
});
test('free variables are explicit dashed wires', () => {
  const m=model('λx.x y'); assert.equal(m.leaves[1].free,true); assert.equal(m.labels[0].text,'y');
  assert.match(D.svg(C.parse('λx.x y')).markup,/stroke-dasharray/);
});
test('all diagrams fit their declared bounds', () => {
  for(const e of P.examples) { const m=model(e.term); for(const l of m.lines) {
    assert.ok(l.x1>=0&&l.x2<=m.width); assert.ok(l.y1>=0&&l.y2<=m.height); assert.ok(l.y1<=l.y2);
  }}
});
test('abstraction spans its entire subtree', () => {
  const m=model('λx.x (λy.y x)'), line=m.lines.find(l=>l.kind==='abstraction'&&l.binder===0);
  assert.ok(line.x1<m.leaves[0].x1); assert.ok(line.x2>m.leaves.at(-1).x1);
});
test('next redex highlights application and its lambda', () => {
  const t=C.parse('λz.(λx.x) z'), m=D.layout(t,C.findRedex(t).path);
  assert.equal(m.lines.filter(l=>l.active).length,2);
});
test('export contains namespace, accessible title and solid background', () => {
  const s=D.svg(C.parse('λx.x'),null,{export:true}).markup;
  assert.match(s,/xmlns="http:\/\/www.w3.org\/2000\/svg"/); assert.match(s,/<title>/); assert.match(s,/<rect/);
});
test('all five challenges normalize to their declared alpha-equivalent target', () => {
  for(const l of P.levels) { const r=C.normalize(C.parse(l.start));
    assert.equal(r.status,'normal',l.name); assert.ok(C.equal(r.term,C.parse(l.target)),l.name);
  }
});
