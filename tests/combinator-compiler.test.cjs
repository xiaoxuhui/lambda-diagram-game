const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),L=require('../src/library.js'),Compiler=require('../src/combinator-compiler.js');
const expand=result=>L.expand(result.term,result.definitions);
test('external compilation preserves beta normal forms, shadowing and free variables without eta contraction',async()=>{
  for(const source of ['λx.x','λx.a','λx.f x','λx.f (g x)','λx.f x a','λx.f x (g x)','λx.f x x','λx.x x','λx.λx.x','λx.(λy.x y)','λx.s x (w x)','(λx.λy.x) y']){
    const term=C.parse(source),result=await Compiler.compileTerm(term),linked=expand(result);
    assert.ok(!result.source.includes('λ'),source+' produces calls, not an embedded compiler');
    const before=C.normalize(term,10000),after=C.normalize(linked,10000);
    assert.equal(after.status,'normal',source);assert.ok(C.equal(after.term,before.term),source);
    assert.deepEqual([...C.freeVars(linked)].sort(),[...C.freeVars(term)].sort(),source);
  }
});
test('other functions actually compile to s, c and w, with linear composition preferred',async()=>{
  const nonlinear=await Compiler.compileTerm(C.parse('λx.f x (g x)'));assert.ok(nonlinear.used.includes('s'));
  const exchange=await Compiler.compileTerm(C.parse('λx.f x a'));assert.ok(exchange.used.includes('c'));
  const square=await Compiler.compileTerm(C.parse('λn.(λm n f.m (n f)) n n'));assert.equal(square.source,'w mul');
  const linear=await Compiler.compileTerm(C.parse('λx.f (g x)'));assert.ok(!linear.used.includes('s'));assert.ok(!linear.used.includes('w'));
  const number=C.normalize(C.A(expand(square),C.parse('3')),10000);assert.equal(C.churchNumber(number.term),9);
});
test('existing definitions are reused and user names and free variables are protected',async()=>{
  const functions=[{name:'s',source:'λx.x',term:C.parse('λx.x')},{name:'flip',source:'λf x y.f y x',term:C.parse('λf x y.f y x')}];
  const swap=await Compiler.compileTerm(C.parse('λf x y.f y x'),{functions});assert.equal(swap.source,'flip');assert.equal(swap.definitions.length,0);
  const result=await Compiler.compileTerm(C.parse('λx.s x (g x)'),{functions});assert.ok(result.used.includes('s2'));
  const linked=L.expand(result.term,[...functions,...result.definitions].filter(fn=>fn.name!=='s'));
  assert.ok(C.freeVars(linked).has('s'));assert.equal(functions[0].source,'λx.x');
});
test('compiler performs no Lambda evaluation and cancellation is supported',async()=>{
  const normalize=C.normalize,step=C.step;
  try{C.normalize=C.step=()=>{throw Error('compiler must not evaluate');};const result=await Compiler.compileTerm(C.parse('λx.f x (g x)'));assert.ok(result.used.includes('s'));}
  finally{C.normalize=normalize;C.step=step;}
  const controller=new AbortController();controller.abort();await assert.rejects(Compiler.compileTerm(C.parse('λx.x'),{signal:controller.signal}),{name:'AbortError'});
});
