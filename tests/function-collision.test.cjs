const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),L=require('../src/library.js'),S=require('../src/snapshot.js'),Default=require('../src/default-state.js'),Compiler=require('../src/combinator-compiler.js');
const definitions=[{name:'id',source:'λx.x'},{name:'entry',source:'λa.id a'}];
test('explicit skip, replace and numbered rename preserve private dependencies and the old library',()=>{
  const old=L.add([],'entry','λx.z');
  for(const collision of L.COLLISIONS){
    const result=L.importDefinitions(old,definitions,['entry'],{collision});assert.equal(C.format(old[0].term),'λx.z');assert.equal(result.functions.some(fn=>fn.name==='id'),false);
    if(collision==='skip'){assert.deepEqual(result.skipped,['entry']);assert.deepEqual(result.functions,old);continue;}
    if(collision==='reuse'){assert.deepEqual(result.reused,['entry']);assert.deepEqual(result.skipped,[]);assert.deepEqual(result.ready,[]);assert.equal(result.functions[0],old[0]);assert.equal(result.bindings.entry,'entry');continue;}
    const actual=collision==='rename'?'entry2':'entry',fn=result.functions.find(fn=>fn.name===actual);assert.equal(result.bindings.entry,actual);assert.equal(C.freeVars(fn.term).size,0);assert.equal(C.churchNumber(C.normalize(C.A(fn.term,C.parse('4')),100).term),4);
    if(collision==='replace'){assert.deepEqual(result.replaced,['entry']);assert.equal(result.functions.length,1);assert.match(L.importFeedback(result),/重名已替换：entry/);}
    else{assert.equal(result.functions[0],old[0]);assert.deepEqual(result.renamed,[{from:'entry',to:'entry2'}]);assert.match(L.importFeedback(result),/entry → entry2/);}
    const again=L.importDefinitions(result.functions,definitions,['entry'],{collision});assert.equal(again.functions.length,result.functions.length);assert.deepEqual(again.ready,[actual]);assert.deepEqual(again.added,[]);
  }
});
test('same definitions are reused in all modes and numbered names cannot steal another selected root or free variable',()=>{
  const same=L.add([],'id','λa.a');for(const collision of L.COLLISIONS){const result=L.importDefinitions(same,definitions,['id'],{collision});assert.equal(result.functions[0],same[0]);assert.deepEqual(collision==='reuse'?result.reused:result.ready,['id']);assert.deepEqual(result.renamed,[]);assert.deepEqual(result.replaced,[]);}
  const old=L.add([],'f','λa.a'),result=L.importDefinitions(old,[{name:'f',source:'λx.free'},{name:'f2',source:'λa.λb.a'}],['f','f2'],{collision:'rename'});assert.equal(result.bindings.f,'f3');assert.equal(result.bindings.f2,'f2');
  const open=L.importDefinitions(old,[{name:'f',source:'λx.f2'}],['f'],{collision:'rename'});assert.equal(open.bindings.f,'f3');assert.deepEqual([...C.freeVars(open.functions.find(fn=>fn.name==='f3').term)],['f2']);
  const prototype=L.importDefinitions(L.add([],'__proto__','λx.z'),[{name:'__proto__',source:'λx.x'}],null,{collision:'rename'});assert.equal(prototype.bindings.__proto__,'__proto__2');
  assert.throws(()=>L.importDefinitions(old,definitions,null,{collision:'oops'}),/重名处理/);
});
test('policies survive archive roundtrips and old archives default to skip',()=>{
  const state=Default.create();for(const mode of L.COLLISIONS){state.view.functionCollision=mode;assert.equal(S.decode(S.encode(state)).view.functionCollision,mode);}
  delete state.view.functionCollision;assert.equal(S.decode(S.encode(state)).view.functionCollision,'skip');
  for(const bad of [null,1,'oops',{}]){state.view.functionCollision=bad;assert.throws(()=>S.encode(state),/重名处理/);}
});
test('SK and BCKW conversions apply the chosen policy and emit working references to renamed primitives',async()=>{
  for(const basis of ['sk','bckw'])for(const collision of L.COLLISIONS){
    const old=L.add([],'k','λx.x'),source=C.parse('λa.λb.a');
    if(collision==='skip'){await assert.rejects(Compiler.compileTerm(source,{basis,functions:old,collision}),/重名/);continue;}
    const compiled=await Compiler.compileTerm(source,{basis,functions:old,collision}),imported=L.importDefinitions(old,compiled.definitions,null,{collision});assert.equal(C.format(old[0].term),'λx.x');
    if(collision==='reuse'){assert.deepEqual(compiled.reused,['k']);assert.ok(compiled.used.includes('k'));assert.equal(imported.functions[0],old[0]);assert.equal(compiled.definitions.some(fn=>fn.name==='k'),false);continue;}
    assert.ok(C.equal(C.normalize(L.expand(compiled.term,imported.functions),10000).term,source));
    if(collision==='rename'){assert.ok(compiled.used.includes('k2'));assert.equal(imported.functions[0],old[0]);const again=await Compiler.compileTerm(source,{basis,functions:imported.functions,collision});assert.equal(again.definitions.length,0);assert.equal(again.source,compiled.source);}
    else{assert.deepEqual(imported.replaced,['k']);assert.ok(compiled.used.includes('k'));}
  }
  const free=await Compiler.compileTerm(C.parse('λx.k'),{basis:'sk',collision:'rename'});assert.ok(C.freeVars(L.expand(free.term,free.definitions)).has('k'));
});
test('direct name reuse does not compare or evaluate the rejected definition and still imports other entries',()=>{
  const old=L.add([],'entry','λx.z'),equal=C.equal,step=C.step;let reused;
  try{C.equal=C.step=()=>{throw Error('name reuse must not compare or run the definition');};reused=L.importDefinitions(old,[{name:'entry',source:'invalid λ.'}],['entry'],{collision:'reuse'});}
  finally{C.equal=equal;C.step=step;}
  assert.equal(reused.functions[0],old[0]);assert.deepEqual(reused.reused,['entry']);assert.match(L.importFeedback(reused),/已直接使用同名函数：entry/);assert.ok(!L.importFeedback(reused).includes('相同定义'));
  const batch=L.importDefinitions(old,[{name:'entry',source:'λx.x'},{name:'next',source:'λn.entry n'}],null,{collision:'reuse'});assert.deepEqual(batch.added,['next']);assert.deepEqual(batch.skipped,[]);assert.equal(C.format(C.normalize(C.A(batch.functions.find(fn=>fn.name==='next').term,C.parse('4')),100).term),'z');
});
test('direct name reuse uses existing helper definitions inside new entries and preserves their lexical free variables',()=>{
  const old=L.add([],'use','λx.free'),defs=[{name:'use',source:'λx.x'},{name:'free',source:'λx.x'},{name:'pair',source:'λa.λb.λk.k a b'},{name:'main',source:'λfree.pair (use free) (free 1)'}];
  const result=L.importDefinitions(old,defs,['main'],{collision:'reuse'}),fn=result.functions.find(fn=>fn.name==='main');assert.deepEqual(result.added,['main']);assert.deepEqual(result.reused,['use']);assert.deepEqual([...C.freeVars(fn.term)],['free']);
  const applied=C.normalize(C.A(fn.term,C.parse('λx.x')),500);assert.equal(applied.status,'normal');assert.ok(C.equal(applied.term,C.parse('λk.k free 1')));
  const registryFree=L.importDefinitions(old,[{name:'use',source:'λx.x'},{name:'free',source:'λx.x'},{name:'main',source:'λx.λk.k (use x) (free x)'}],['main'],{collision:'reuse'});assert.deepEqual([...C.freeVars(registryFree.functions.at(-1).term)],['free']);assert.ok(C.equal(C.normalize(C.A(registryFree.functions.at(-1).term,C.parse('2')),500).term,C.parse('λk.k free 2')));
});
