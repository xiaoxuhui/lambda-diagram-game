const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),S=require('../src/snapshot.js');
const sample=()=>({version:3,draft:'(λx.x) ((λy.y) z)',functions:[],completed:[],mode:'free',level:0,
  session:{original:C.parse('(λx.x) ((λy.y) z)'),steps:2,paths:[['arg'],null],dirty:false,halt:''},
  view:{speed:600,strategy:'normal',scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''});
test('normal and applicative order choose different first steps and the same normal form',()=>{
  const t=C.parse('(λx.x) ((λy.y) z)');assert.deepEqual(C.findRedex(t).path,[]);assert.deepEqual(C.findRedex(t,[],'applicative').path,['arg']);
  assert.equal(C.format(C.step(t).term),'(λy.y) z');assert.equal(C.format(C.step(t,'applicative').term),'(λx.x) z');
  for(const order of C.STRATEGIES)assert.equal(C.format(C.normalize(t,10,order).term),'z');
});
test('applicative reduces lambda function body before the argument and outer application',()=>{
  let t=C.parse('(λx.(λa.a) x) ((λy.y) z)');for(const expected of [['fn','body'],['arg'],[]]){const step=C.step(t,'applicative');assert.deepEqual(step.path,expected);t=step.term;}assert.equal(C.format(t),'z');
});
test('normal discards unused divergence while applicative keeps reducing it',()=>{
  const t=C.parse('(λx.y) ((λz.z z) (λz.z z))');assert.equal(C.format(C.step(t).term),'y');
  const step=C.step(t,'applicative');assert.deepEqual(step.path,['arg']);assert.ok(C.equal(step.term,t));assert.equal(C.normalize(t,10,'applicative').status,'cycle');
});
test('both orders reduce inside lambdas and preserve capture avoidance',()=>{
  for(const order of C.STRATEGIES){assert.equal(C.format(C.step(C.parse('λz.(λx.x) z'),order).term),'λz.z');assert.ok(C.equal(C.step(C.parse('(λx.λy.x) y'),order).term,C.parse('λq.y')));}
});
test('mixed history replays exact paths independently from the current preference',()=>{
  for(const strategy of C.STRATEGIES){const s=sample();s.view.strategy=strategy;const r=S.decode(S.encode(s));assert.equal(C.format(r.history[1].term),'(λx.x) z');assert.equal(C.format(r.term),'z');assert.equal(r.view.strategy,strategy);assert.equal(r.version,3);}
});
test('legacy snapshots default to normal and invalid strategies are rejected',()=>{
  const s=sample();delete s.view.strategy;assert.equal(S.decode(S.encode(s)).view.strategy,'normal');
  for(const strategy of ['other',3,{},'']){s.view.strategy=strategy;assert.throws(()=>S.decode(JSON.stringify(s)),/归约顺序/);assert.throws(()=>C.step(C.parse('λx.x'),strategy),/归约顺序/);}
});
test('applicative lookup stays iterative through ten thousand binders and keeps path prefix compatibility',()=>{
  let t=C.parse('(λx.x) z');for(let i=0;i<10000;i++)t=C.L('a',t);const path=C.findRedex(t,[],'applicative').path;assert.equal(path.length,10000);
  assert.deepEqual(C.findRedex(C.parse('(λx.x) z'),['body'],'applicative').path,['body']);
});
