const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),Compiler=require('../src/combinator-compiler.js'),L=require('../src/library.js'),S=require('../src/snapshot.js'),Default=require('../src/default-state.js');
test('ordinary conversion skips special cases and beta simplification in every basis',async()=>{
  for(const basis of ['optimized','sk','bckw']){
    const expected={optimized:'i z',sk:'s k k z',bckw:'w k z'}[basis];
    assert.equal((await Compiler.compileTerm(C.parse('(λx.x) z'),{basis,specialize:false})).source,expected);
    const one=await Compiler.compileTerm(C.parse('2'),{basis,specialize:false}),special=await Compiler.compileTerm(C.parse('2'),{basis,simplify:basis==='sk'});assert.notEqual(one.source,special.source);
    if(basis==='sk')assert.equal((await Compiler.compileTerm(C.parse('λa.λb.b'),{basis,specialize:false,simplify:true})).source,'k (s k k)');
    if(basis==='bckw')assert.equal((await Compiler.compileTerm(C.parse('λa.λb.b'),{basis,specialize:false})).source,'k (w k)');
  }
});
test('ordinary abstraction preserves normal forms, free variables and the requested primitives',async()=>{
  for(const basis of ['optimized','sk','bckw'])for(const source of ['λx.x','λa.λb.b','λf.λx.λy.f y x','λx.f (g x)','λx.f x x','λx.f x','λx.λx.x','(λx.λy.x) y','λn.λf.λx.f (n f x)','0','1','2','3']){
    const term=C.parse(source),result=await Compiler.compileTerm(term,{basis,specialize:false}),expanded=L.expand(result.term,result.definitions);
    assert.ok(C.equal(C.normalize(expanded,100000).term,C.normalize(term,100000).term),basis+' '+source);
    assert.deepEqual([...C.freeVars(expanded)].sort(),[...C.freeVars(term)].sort());
    if(basis!=='optimized')assert.ok(result.used.every(name=>(basis==='sk'?['s','k']:['b','c','k','w']).includes(name)));
  }
});
test('ordinary mode never recognizes Church values or runs Lambda, and remains cancellable',async()=>{
  const terms=['0','3','λn.λf.λx.f (n f x)','(λx.x x) (λx.x x)'].map(s=>C.parse(s)),number=C.churchNumber,normalize=C.normalize,step=C.step;
  try{C.churchNumber=C.normalize=C.step=()=>{throw Error('no value recognition or evaluation');};
    for(const basis of ['optimized','sk','bckw'])for(const term of terms)assert.ok((await Compiler.compileTerm(term,{basis,specialize:false})).source);
  }finally{C.churchNumber=number;C.normalize=normalize;C.step=step;}
  const controller=new AbortController();controller.abort();await assert.rejects(Compiler.compileTerm(C.parse('λx.x'),{specialize:false,signal:controller.signal}),{name:'AbortError'});
  await assert.rejects(Compiler.compileTerm(C.parse('λx.x'),{specialize:'no'}),/开关/);
});
test('ordinary conversions reuse primitives and preserve user functions on collisions',async()=>{
  let functions=[];const first=await Compiler.compileTerm(C.parse('λa.λb.b'),{basis:'bckw',specialize:false});functions.push(...first.definitions);
  const again=await Compiler.compileTerm(C.parse('λa.λb.b'),{basis:'bckw',specialize:false,functions});assert.equal(again.definitions.length,0);assert.equal(again.source,first.source);
  const wrong=L.add([],'w','λx.x');await assert.rejects(Compiler.compileTerm(C.parse('λx.x'),{basis:'bckw',specialize:false,functions:wrong}),/重名/);assert.equal(C.format(wrong[0].term),'λx.x');
});
test('the independent compiler preference survives archives and old saves keep the previous default',()=>{
  const state=Default.create();for(const enabled of [true,false]){state.view.compilerSpecial=enabled;const r=S.decode(S.encode(state));assert.equal(r.view.compilerSpecial,enabled);assert.equal(r.view.unfoldFunctions,false);}
  delete state.view.compilerSpecial;assert.equal(S.decode(S.encode(state)).view.compilerSpecial,true);
  for(const invalid of ['false',1,null,{}]){state.view.compilerSpecial=invalid;assert.throws(()=>S.encode(state),/特殊化简开关/);}
});
