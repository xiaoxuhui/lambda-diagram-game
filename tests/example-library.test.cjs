const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../src/example-library.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),L=require('../src/library.js'),C=require('../src/core.js'),S=require('../src/snapshot.js'),Default=require('../src/default-state.js');
test('all examples merge exact original definitions and shared dependencies only once',()=>{
  const batch=B.collect(P.examples.map((_,index)=>index)),expected=new Map();
  for(const example of P.examples)for(const definition of G.lesson(example).symbols)expected.set(definition.name,definition.source);
  assert.equal(batch.examples.length,P.examples.length);assert.equal(batch.definitions.length,expected.size);
  const imported=L.importDefinitions([],batch.definitions,null,{exact:true});
  for(const fn of imported.functions)assert.equal(fn.source,expected.get(fn.name));
  assert.equal(L.importDefinitions(imported.functions,batch.definitions,null,{exact:true}).added.length,0);
  const state=Default.create();state.functions=imported.functions;state.mode='library';
  const restored=S.decodeStartingState(S.encode(state));assert.equal(restored.mode,'library');assert.equal(restored.functions.length,expected.size);
  for(const fn of restored.functions)assert.equal(fn.source,expected.get(fn.name));
});
test('individual, chapter and repeated selections have the exact union of definitions',()=>{
  for(const category of new Set(P.examples.map(example=>example.category||'入门'))){
    const indices=P.examples.flatMap((example,index)=>(example.category||'入门')===category?[index]:[]),batch=B.collect([...indices,...indices]),names=new Set();
    for(const index of indices)for(const definition of G.lesson(P.examples[index]).symbols)names.add(definition.name);
    assert.equal(batch.examples.length,indices.length);assert.deepEqual(new Set(batch.definitions.map(fn=>fn.name)),names);
  }
  const nth=P.examples.findIndex(example=>example.listOperation?.name==='nth');
  assert.deepEqual(B.collect([nth]).definitions,G.lesson(P.examples[nth]).symbols);
  assert.deepEqual(B.collect([]),{definitions:[],examples:[],empty:[]});assert.throws(()=>B.collect([-1]),/不存在/);
});
test('batch conflicts are atomic and require explicit replacement while unrelated functions survive',()=>{
  const batch=B.collect(P.examples.map((_,index)=>index)),name=batch.definitions[0].name;
  const before=L.add(L.add([],'mykeep','λx.x'),name,'λx.other');
  for(const collision of ['skip','rename','reuse'])assert.throws(()=>L.importDefinitions(before,batch.definitions,null,{exact:true,collision}),error=>error.conflicts.includes(name));
  assert.equal(before.length,2);assert.equal(before[1].source,'λx.other');
  const result=L.importDefinitions(before,batch.definitions,null,{exact:true,collision:'replace'});
  assert.equal(result.functions.length,batch.definitions.length+1);assert.equal(result.functions.find(fn=>fn.name==='mykeep').source,'λx.x');
});
test('merged named functions still compute list lookup normally',()=>{
  const batch=B.collect(P.examples.map((_,index)=>index)),functions=L.importDefinitions([],batch.definitions,null,{exact:true}).functions;
  const result=C.normalize(L.expand(C.parse('nth [1,2,3] 2'),functions),Infinity);assert.equal(C.churchNumber(result.term),2);
});
