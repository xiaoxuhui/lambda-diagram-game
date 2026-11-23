const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),L=require('../src/library.js'),E=require('../src/data-encoding.js'),S=require('../src/snapshot.js');
test('fixed helper arguments are internal and only one self-contained entry is imported',()=>{
  for(const example of P.examples.filter(e=>e.capsule||e.name.includes('去零')||e.sequenceId)){
    const doc=G.lesson(example),names=G.libraryNames(doc),result=L.importDefinitions([],doc.symbols,names);
    assert.equal(names.length,1,example.name);assert.deepEqual(result.added,names);assert.equal(result.functions.length,1);
    const fn=result.functions[0];assert.equal(C.freeVars(fn.term).size,0,example.name);
    assert.ok(!doc.inputs.some(input=>['predicate','c','f'].includes(input.name)),example.name+' exposes only its actual data');
    if(example.capsule||example.name.includes('去零')){
      const r=C.normalize(L.expand(E.parse(doc.compact).term,result.functions),30000);
      assert.equal(r.status,'normal',example.name);assert.ok(C.equal(r.term,C.parse(example.expected??P.I)),example.name);
    }
    assert.deepEqual(L.importDefinitions(result.functions,doc.symbols,names).ready,names);
  }
});
test('packed local helpers preserve data parameters, external free variables and shadowing',()=>{
  const definitions=[{name:'id',source:'λx.free'},{name:'helper',source:'λx.id x'},{name:'main',source:'λid.λfree.helper id'}];
  const result=L.importDefinitions([],definitions,['main']),fn=result.functions[0];
  assert.deepEqual(result.added,['main']);assert.deepEqual([...C.freeVars(fn.term)],['free']);
  const r=C.normalize(C.A(C.A(fn.term,C.parse('4')),C.parse('9')),1000);
  assert.equal(r.status,'normal');assert.equal(C.format(r.term),'free');
  assert.ok(!fn.source.startsWith('λid.'));
});
test('packing recursive functions never executes them',()=>{
  const normalize=C.normalize,step=C.step;
  try{C.normalize=C.step=()=>{throw Error('do not evaluate during packaging');};
    const result=L.importDefinitions([],[{name:'omega',source:'(λx.x x) (λx.x x)'},{name:'entry',source:'λn.omega n'}],['entry']);
    assert.deepEqual(result.added,['entry']);assert.equal(C.freeVars(result.functions[0].term).size,0);
  }finally{C.normalize=normalize;C.step=step;}
});
test('a packaged entry survives archive restore without auxiliary library entries',()=>{
  const example=P.examples.find(e=>e.name.includes('映射 MAP')),doc=G.lesson(example),functions=L.importDefinitions([],doc.symbols,G.libraryNames(doc)).functions;
  const state=require('../src/default-state.js').create();state.functions=functions;
  const restored=S.decode(S.encode(state));assert.deepEqual(restored.functions.map(fn=>fn.name),['incmap']);
  const r=C.normalize(L.expand(C.parse('incmap [0,2,4]'),restored.functions),10000);
  assert.equal(r.status,'normal');assert.ok(C.equal(r.term,C.parse('[1,3,5]')));
});
