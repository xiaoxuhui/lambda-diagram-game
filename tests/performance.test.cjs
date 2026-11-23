const {test}=require('node:test'),assert=require('node:assert/strict');
const before=require('./fixtures/core-before-performance.cjs'),C=require('../src/core.js');
const Lazy=require('../src/lazy-eval.js');
const Trace=require('../src/trace.js');
test('engine nodes are immutable so cached structural facts cannot become stale',()=>{
  const term=C.parse('(λx.x) y');assert.ok(Object.isFrozen(term));assert.ok(Object.isFrozen(term.fn));assert.ok(Object.isFrozen(term.arg));
  assert.throws(()=>Object.defineProperty(term,'arg',{value:C.V('z')}),TypeError);assert.equal(C.format(C.step(term).term),'y');
});
test('long normal subtrees survive sparse reduction by identity and retain all occurrences',()=>{
  let body=C.V('z');for(let i=0;i<2500;i++)body=C.A(C.V('f'),body);
  const normal=C.L('z',body),term=C.A(C.A(C.V('g'),normal),C.A(C.L('x',C.V('x')),C.V('y'))),result=C.step(term);
  assert.deepEqual(result.path,['arg']);assert.equal(result.term.fn,term.fn);assert.equal(result.term.fn.arg,normal);assert.equal(C.inspect(result.term).nodes,5006);
  assert.equal(C.findRedex(result.term),null);assert.ok(C.format(result.term).includes('λz.f (f'));assert.equal(C.format(result.term).match(/\bf\b/g).length,2500);
});
test('deep binder substitution and formatting avoid the JavaScript call stack limit',()=>{
  let body=C.V('x');for(let i=0;i<10000;i++)body=C.L(`a${i}`,body);
  const result=C.step(C.A(C.L('x',body),C.V('y')));assert.equal(C.inspect(result.term).depth,10001);assert.equal(C.freeVars(result.term).has('y'),true);
  assert.ok(C.format(result.term).endsWith('.y'));assert.equal(C.findRedex(result.term),null);
});
test('unused branches are neither renamed nor rebuilt during substitution',()=>{
  const untouched=C.parse('λy.y'),body=C.A(untouched,C.V('x')),result=C.substitute(body,'x',C.V('y'));
  assert.equal(result.fn,untouched);assert.equal(result.arg.name,'y');assert.equal(C.substitute(untouched,'missing',C.V('y')),untouched);
});
test('mutable external ASTs are not served stale cached facts',()=>{
  const raw={type:'app',fn:{type:'var',name:'f'},arg:{type:'var',name:'x'}};assert.equal(C.findRedex(raw),null);
  raw.fn={type:'abs',param:'x',body:{type:'var',name:'x'}};assert.deepEqual(C.findRedex(raw).path,[]);assert.equal(C.format(C.step(raw).term),'x');
});
test('recomputed contractions retain capture avoidance without storing old results',()=>{
  const fn=C.parse('λx.λy.x'),arg=C.V('y');
  const first=C.step(C.A(fn,arg)),second=C.step(C.A(fn,arg));
  assert.notEqual(first.replacement,second.replacement);
  assert.deepEqual(first.replacement,second.replacement);
  assert.equal(C.format(second.term),'λy1.y');
  const raw={type:'var',name:'a'};
  assert.equal(C.format(C.step(C.A(fn,raw)).term),'λy.a');
  raw.name='y';
  assert.equal(C.format(C.step(C.A(fn,raw)).term),'λy1.y');
});
test('fixed-order traces retain only recent frames and one rule for an arbitrarily long run',async()=>{
  const original=C.parse('(λx.f (x x)) (λx.f (x x))'),trace=Trace.create(original);
  let term=original,first;
  for(let i=0;i<200;i++){
    const change=C.step(term,'normal','right');term=change.term;
    trace.append(change,'normal:right');if(i===0)first=term;
  }
  assert.equal(trace.length,201);
  assert.deepEqual(trace.choices,[[0,'normal:right']]);
  assert.equal(trace.peek(1),undefined);
  assert.ok(C.equal((await trace.replay(1)).term,first));
  assert.equal(trace.peek(197)!==undefined,true);
  assert.equal(trace.peek(196),undefined);
  for(let i=0;i<6;i++){
    const target=trace.length-2,frames=trace.peek(target)?undefined:await trace.replay(target,{keepRecent:true});
    const prior=trace.rewind(frames);
    assert.equal(C.inspect(term).nodes-C.inspect(prior.term).nodes,2);term=prior.term;
  }
});
test('shared normalization reuses a complete result under binders without capture',async()=>{
  const input=C.parse('(λd.f d d) (λx.(λy.λx.y) x)');
  const result=await Lazy.normalize(input);
  assert.ok(C.equal(result,C.parse('f (λx z.x) (λx z.x)')));
  assert.equal(result.fn.arg,result.arg);
  assert.equal(C.hasRedex(result),false);
  await assert.rejects(Lazy.normalize(C.parse('(λx.x x) (λx.x x)'),{signal:AbortSignal.timeout(1000)}),/重复求值循环/);
  await assert.rejects(Lazy.normalize(C.parse('(λx.f (x x)) (λx.f (x x))'),{signal:AbortSignal.timeout(1000)}),/无限增长/);
});

test('recursive expansion is stopped under neutral heads, duplicated branches and function spines',async()=>{
  for(const source of [
    '(λx.f (f (x x))) (λx.f (f (x x)))',
    '(λx.f (x x) (x x)) (λx.f (x x) (x x))',
    '(λx.x x x) (λx.x x x)',
    '(λx.λn.f (x x)) (λx.λn.f (x x))'
  ]){
    await assert.rejects(Lazy.normalize(C.parse(source),{signal:AbortSignal.timeout(1000)}),/循环|无限增长/,source);
  }
});

test('structural growth detection preserves manual steps and distinguishes a repeated state',()=>{
  for(const source of [
    '(λx.f (f (x x))) (λx.f (f (x x)))',
    '(λx.f (x x) (x x)) (λx.f (x x) (x x))',
    '(λx.x x x) (λx.x x x)',
    '(λx.λn.f (x x)) (λx.λn.f (x x))'
  ]){
    const term=C.parse(source),guard=C.cycleCheck(term),change=C.step(term);
    assert.equal(guard(change.term,change),true);assert.equal(guard.reason,'growth');
    assert.ok(C.step(change.term));
    assert.equal(C.normalize(term,20).status,'cycle');
  }
  const omega=C.parse('(λx.x x) (λx.x x)'),guard=C.cycleCheck(omega),change=C.step(omega);
  assert.equal(guard(change.term,change),true);assert.equal(guard.reason,'cycle');
});

test('finite duplication, discarded recursive bodies and substantial output are not mistaken for divergence',async()=>{
  for(const source of [
    '(λd.f d d) ((λx.x) y)',
    '(λi.f (i y) (i y)) (λx.x)',
    '((λx.λk.k (x x)) (λx.λk.k (x x))) (λz.y)',
    '(λx.y) ((λx.f (x x)) (λx.f (x x)))',
    '(λm n.n m) 2 10'
  ]){
    const term=C.parse(source),expected=C.normalize(term,20000);
    assert.equal(expected.status,'normal',source);
    assert.ok(C.equal(await Lazy.normalize(term,{signal:AbortSignal.timeout(5000)}),expected.term),source);
  }
  let body=C.V('z');for(let i=0;i<2000;i++)body=C.A(C.V('f'),body);
  const term=C.A(C.L('x',C.V('x')),C.L('z',body));
  assert.ok(C.equal(await Lazy.normalize(term),term.arg));
  const P=require('../src/presets.js');
  for(const factorial of [P.advanced.factorial,P.advanced.recursiveFactorial]){
    const term=C.parse(`(${factorial}) 3`);
    assert.equal(C.churchNumber(await Lazy.normalize(term)),6);
    assert.equal(C.normalize(term,20000).status,'normal');
  }
});

test('growth guard does not reject terminating randomly generated terms',async()=>{
  let seed=7319;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  const names=['x','y','z'];
  function term(depth){if(!depth||random(4)===0)return C.V(names[random(3)]);return random(2)?C.L(names[random(3)],term(depth-1)):C.A(term(depth-1),term(depth-1));}
  for(let i=0;i<300;i++){
    const original=term(5),reference=before.normalize(original,100);
    if(reference.status!=='normal')continue;
    const result=C.normalize(original,100);
    assert.equal(result.status,'normal',C.format(original));assert.ok(C.equal(result.term,reference.term));
    assert.ok(C.equal(await Lazy.normalize(original,{signal:AbortSignal.timeout(1000)}),reference.term),C.format(original));
  }
});

test('cancellation remains available when recursive arguments change on every call',async()=>{
  const term=C.parse('(λf.(λx.f (x x)) (λx.f (x x))) (λr n.r ((λn f x.f (n f x)) n)) 0');
  await assert.rejects(Lazy.normalize(term,{signal:AbortSignal.timeout(25)}),/取消/);
});
test('seeded differential reductions and alpha equality match the previous engine',()=>{
  let seed=9173;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;},names=['x','y','z'];
  function term(depth){if(!depth||random(4)===0)return C.V(names[random(3)]);if(random(2))return C.L(names[random(3)],term(depth-1));return C.A(term(depth-1),term(depth-1));}
  for(let i=0;i<240;i++){
    const start=term(5);let a=start,b=start;
    for(let j=0;j<5;j++){const ra=C.step(a),rb=before.step(b);assert.equal(ra===null,rb===null);if(!ra)break;
      assert.deepEqual(ra.path,rb.path);assert.deepEqual(C.alphaKey(ra.term),before.alphaKey(rb.term));assert.equal(C.format(ra.term),before.format(rb.term));a=ra.term;b=rb.term;}
    const other=term(4);assert.equal(C.equal(start,other),before.equal(start,other));assert.equal(C.equal(start,start),true);
  }
});
