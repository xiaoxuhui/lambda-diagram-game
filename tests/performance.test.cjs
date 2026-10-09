const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),before=require('./fixtures/core-before-performance.cjs');
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
