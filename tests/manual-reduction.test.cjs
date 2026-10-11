const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),S=require('../src/snapshot.js'),D=require('../src/diagram.js');
const sample=()=>({version:2,draft:'(λx.x) ((λy.y) z)',functions:[],completed:[],mode:'free',level:0,
  session:{original:C.parse('(λx.x) ((λy.y) z)'),steps:2,paths:[['arg'],null],dirty:false,halt:''},
  view:{speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''});
test('selected inner redex contracts before the normal-order outer redex',()=>{
  const t=C.parse('(λx.x) ((λy.y) z)'),r=C.stepAt(t,['arg']);assert.equal(C.format(r.term),'(λx.x) z');
  assert.equal(C.format(C.step(t).term),'(λy.y) z');assert.equal(r.term.fn,t.fn);assert.deepEqual(r.path,['arg']);
});
test('selected reduction inside abstractions avoids capture',()=>{
  const r=C.stepAt(C.parse('λz.f ((λx.λy.x) y)'),['body','arg']);
  assert.ok(C.equal(r.term,C.parse('λz.f (λq.y)')));assert.deepEqual([...C.freeVars(r.term)].sort(),['f','y']);
});
test('invalid or non-redex paths never modify a term',()=>{
  const t=C.parse('(λx.x) y');for(const p of [null,'arg',['arg'],['fn'],['body'],['__proto__'],['fn','arg']])assert.equal(C.stepAt(t,p),null);
  assert.equal(C.format(t),'(λx.x) y');assert.equal(C.format(C.stepAt(t,[]).term),'y');
});
test('manual and automatic history replays exactly, including backup checkpoint',()=>{
  const s=sample(),r=S.decode(S.encodeBackup(s,S.encode(s)));assert.equal(C.format(r.term),'z');assert.equal(C.format(r.history[1].term),'(λx.x) z');
  assert.deepEqual(r.session.paths,[['arg'],null]);assert.equal(C.format(S.decode(r.checkpointText).history[1].term),'(λx.x) z');
});
test('old step-only snapshots keep their normal-order history',()=>{
  const s=sample();delete s.session.paths;const r=S.decode(S.encode(s));assert.equal(C.format(r.history[1].term),'(λy.y) z');assert.equal(C.format(r.term),'z');
});
test('malformed and non-executable stored paths are rejected',()=>{
  for(const paths of [[],[null],[['constructor'],null],['arg',null],[['fn'],null],[['arg'],['arg']]]){
    const s=sample();s.session.paths=paths;assert.throws(()=>S.decode(JSON.stringify(s)),/路径/);
  }
});
