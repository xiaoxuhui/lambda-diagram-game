const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),E=require('../src/data-encoding.js'),F=require('../src/function-reduction.js'),L=require('../src/library.js'),S=require('../src/snapshot.js'),Default=require('../src/default-state.js');
function normal(prepared,strategy='normal',direction='left'){
  const reducer=F.create(prepared.definitions);let term=prepared.term;
  for(let i=0;i<1000;i++){const step=reducer.step(term,strategy,direction);if(!step)return term;term=step.term;}
  throw Error('test failed to terminate');
}
test('the numeric function preference persists, accepts older saves and rejects invalid values',()=>{
  const snapshot=Default.create();
  for(const value of [false,true]){snapshot.view.dataAsFunctions=value;assert.equal(S.decode(S.encode(snapshot)).view.dataAsFunctions,value);}
  delete snapshot.view.dataAsFunctions;assert.equal(S.decode(S.encode(snapshot)).view.dataAsFunctions,true);
  snapshot.view.dataAsFunctions='yes';assert.throws(()=>S.encode(snapshot),/开关/);
});
test('Church numerals and explicit empty/nested lists become one-layer function calls',async()=>{
  for(const source of ['0','3','[]','[1,2]','[[],[2]]','123_list']){
    const compiled=await E.compile(source,[],'church'),prepared=F.prepare(compiled.term,[],compiled.dataTerms);
    assert.equal(prepared.term.type,'var');assert.match(prepared.term.name,source==='0'||source==='3'?/^n/:/^list/);
    const step=F.create(prepared.definitions).step(prepared.term);assert.equal(step.kind,'unfold');
    if(source==='[1,2]')assert.deepEqual([...C.freeVars(step.term)].sort(),['n1','n2']);
    for(const strategy of C.STRATEGIES)for(const direction of C.DIRECTIONS)assert.ok(C.equal(normal(prepared,strategy,direction),C.normalize(compiled.term,10000).term),source);
  }
});
test('list elements retain surrounding bindings and free variables, with collision-free aliases',async()=>{
  for(const source of ['λx.[x,1]','[y,2]','λn2.f n2 2','λlist1.[list1,[2]]']){
    const compiled=await E.compile(source,[],'church'),prepared=F.prepare(compiled.term,[],compiled.dataTerms);
    assert.ok(C.equal(normal(prepared),C.normalize(compiled.term,10000).term),source);
  }
  const compiled=await E.compile('λn2.f n2 2',[],'church'),prepared=F.prepare(compiled.term,[],compiled.dataTerms);assert.equal(prepared.definitions[0].name,'n2_2');
});
test('data inside saved functions unfolds separately without adding functions to the user library',async()=>{
  const functions=L.add([],'two','2'),compiled=await E.compile('two',[],'church'),prepared=F.prepare(compiled.term,functions,compiled.dataTerms),reducer=F.create(prepared.definitions);
  assert.equal(functions.length,1);const first=reducer.step(prepared.term);assert.equal(first.term.name,'n2');
  assert.equal(C.churchNumber(reducer.step(first.term).term),2);
  assert.ok(C.equal(C.normalize(F.expand(prepared.term,prepared.definitions),10000).term,C.parse('2')));
});
test('frozen data functions replay, undo and project into legacy saves',async()=>{
  const compiled=await E.compile('[1,2]',[],'church'),prepared=F.prepare(compiled.term,[],compiled.dataTerms),first=F.create(prepared.definitions).step(prepared.term),snapshot=Default.create();
  snapshot.functions=[];snapshot.draft='[1,2]';snapshot.view.unfoldFunctions=true;
  snapshot.session={original:prepared.term,functionDefinitions:prepared.definitions,steps:1,dirty:false,halt:'',choices:[[0,{unfold:[]}]],encodings:['church','list']};
  const restored=S.decode(S.encode(snapshot),{compact:true});assert.ok(C.equal(restored.term,first.term));assert.equal(restored.functions.length,0);
  assert.ok(C.equal(restored.trace.peek(0).term,prepared.term));
  const legacy=S.decode(JSON.stringify(S.legacyMirror(restored)));assert.ok(C.equal(C.normalize(legacy.term,10000).term,compiled.term));
});
