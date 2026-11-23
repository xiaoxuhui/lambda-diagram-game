const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),L=require('../src/library.js'),E=require('../src/data-encoding.js');
const example=P.examples.find(e=>e.name.includes('去零'));
test('zero filtering encapsulates its predicate and accepts only the list',()=>{
  const doc=G.lesson(example),plan=P.programFor(example),selected=G.libraryNames(doc);
  assert.equal(doc.compact,'dropzero [0,2,0,3]');assert.deepEqual(selected,['dropzero']);
  assert.equal(doc.inputs.length,1);assert.match(plan.call,/^\(dropzero\)/);
  assert.ok(!plan.argumentFunctions.includes('nonzero'));
  assert.ok(plan.definitions.some(d=>d.originalName==='nonzero'));assert.match(plan.source,/λnonzero\./);
  const main=doc.symbols.find(s=>s.name==='dropzero');assert.deepEqual([...C.freeVars(C.parse(main.source))].sort(),['filter','nonzero']);
  const {functions}=L.importDefinitions([],doc.symbols,selected);
  assert.deepEqual(functions.map(f=>f.name),['dropzero']);
  const predicates=L.importDefinitions([],doc.symbols,['nonzero']).functions;
  for(const [n,value] of [[0,'false'],[1,'true'],[2,'true'],[8,'true']]){
    const r=C.normalize(L.expand(C.parse('nonzero '+n),predicates),1000);
    assert.equal(r.status,'normal');assert.ok(C.equal(r.term,C.parse(value==='false'?'λa.λb.b':'λa.λb.a')));
  }
  for(const [input,output] of [['[]','[]'],['[0]','[]'],['[0,0,0]','[]'],['[2,3]','[2,3]'],['[0,2,0,3]','[2,3]'],['[0,1,0,0,2,0]','[1,2]']]){
    const r=C.normalize(L.expand(C.parse('dropzero '+input),functions),10000);
    assert.equal(r.status,'normal');assert.ok(C.equal(r.term,C.parse(output)),input);
  }
  assert.ok(C.equal(C.normalize(E.parse(plan.source).term,10000).term,C.parse(example.expected)));
  assert.ok(doc.steps.some(s=>s[1].includes('不是强制求值顺序')));
});
test('argument functions import alongside the main program and preserve same-name user definitions',()=>{
  const original=L.add([],'nonzero','λx.λa.λb.a'),doc=G.lesson(example),result=L.importDefinitions(original,doc.symbols,G.libraryNames(doc));
  assert.equal(result.functions[0],original[0]);assert.deepEqual(result.added,['dropzero']);assert.deepEqual(result.skipped,[]);
  assert.ok(!result.functions.some(fn=>fn.name==='nonzero2'));assert.equal(result.functions.length,2);
  const r=C.normalize(L.expand(C.parse('dropzero [0,2,0,3]'),result.functions),10000);
  assert.equal(r.status,'normal');assert.ok(C.equal(r.term,C.parse('[2,3]')));
  const mapDoc=G.lesson(P.examples.find(e=>e.name.includes('映射 MAP')));
  assert.deepEqual(G.libraryNames(mapDoc),['incmap']);
});
