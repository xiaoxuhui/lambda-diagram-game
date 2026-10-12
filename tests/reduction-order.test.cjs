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
  for(const strategy of [null,'other',3,{},'']){s.view.strategy=strategy;assert.throws(()=>S.decode(JSON.stringify(s)),/归约顺序/);assert.throws(()=>C.step(C.parse('λx.x'),strategy),/归约顺序/);}
});
test('applicative lookup stays iterative through ten thousand binders and keeps path prefix compatibility',()=>{
  let t=C.parse('(λx.x) z');for(let i=0;i<10000;i++)t=C.L('a',t);const path=C.findRedex(t,[],'applicative').path;assert.equal(path.length,10000);
  assert.deepEqual(C.findRedex(C.parse('(λx.x) z'),['body'],'applicative').path,['body']);
});
test('both strategies can choose the right sibling first and still reach the same normal form',()=>{
  const t=C.parse('((λa.a) u) ((λb.b) v)');
  for(const strategy of C.STRATEGIES){
    assert.deepEqual(C.findRedex(t,[],strategy,'left').path,['fn']);
    assert.deepEqual(C.findRedex(t,[],strategy,'right').path,['arg']);
    assert.equal(C.format(C.step(t,strategy,'right').term),'(λa.a) u v');
    for(const direction of C.DIRECTIONS)assert.equal(C.format(C.normalize(t,10,strategy,direction).term),'u v');
  }
});
test('right normal order retains outermost priority',()=>{
  const t=C.parse('(λx.(λa.a) x) ((λb.b) z)');
  assert.deepEqual(C.findRedex(t,[],'normal','right').path,[]);
  assert.equal(C.format(C.step(t,'normal','right').term),'(λa.a) ((λb.b) z)');
});
test('right applicative order reduces argument then function body then outer application',()=>{
  let t=C.parse('(λx.(λa.a) x) ((λb.b) z)');
  for(const expected of [['arg'],['fn','body'],[]]){const s=C.step(t,'applicative','right');assert.deepEqual(s.path,expected);t=s.term;}
  assert.equal(C.format(t),'z');
});
test('right directions still enter lambda bodies and avoid variable capture through deep iterative search',()=>{
  for(const strategy of C.STRATEGIES){
    assert.equal(C.format(C.step(C.parse('λz.(λx.x) z'),strategy,'right').term),'λz.z');
    assert.ok(C.equal(C.step(C.parse('(λx.λy.x) y'),strategy,'right').term,C.parse('λq.y')));
  }
  let t=C.parse('((λa.a) u) ((λb.b) v)');for(let i=0;i<10000;i++)t=C.L('x',t);
  assert.deepEqual(C.findRedex(t,[],'applicative','right').path,[...Array(10000).fill('body'),'arg']);
});
test('mixed directions replay exact paths independently from the latest preference',()=>{
  for(const direction of C.DIRECTIONS){const s=sample();s.view.direction=direction;
    const r=S.decode(S.encode(s));assert.equal(r.view.direction,direction);assert.equal(C.format(r.history[1].term),'(λx.x) z');assert.equal(C.format(r.term),'z');
  }
});
test('legacy steps always replay normal left order even if the latest preference is right',()=>{
  const s=sample();delete s.view.direction;delete s.session.paths;s.session.steps=1;
  let r=S.decode(S.encode(s));assert.equal(r.view.direction,'left');assert.equal(C.format(r.term),'(λy.y) z');
  s.view.direction='right';r=S.decode(S.encode(s));assert.equal(r.view.direction,'right');assert.equal(C.format(r.term),'(λy.y) z');
});
test('invalid directions are rejected by engine and snapshots',()=>{
  const s=sample(),t=C.parse('λx.x');for(const direction of [null,'other',3,{},'']){
    s.view.direction=direction;assert.throws(()=>S.decode(JSON.stringify(s)),/归约方向/);
    assert.throws(()=>C.findRedex(t,[],'normal',direction),/归约方向/);
    assert.throws(()=>C.step(t,'normal',direction),/归约方向/);
    assert.throws(()=>C.normalize(t,0,'normal',direction),/归约方向/);
  }
});
