const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),E=require('../src/data-encoding.js'),S=require('../src/sequences.js'),L=require('../src/library.js'),Snapshot=require('../src/snapshot.js'),Default=require('../src/default-state.js');
const parsed=source=>E.parse(source,[],Infinity,'church').term;
const normal=term=>{const result=C.normalize(term,300000);assert.equal(result.status,'normal');return result.term;};
const list=values=>C.churchList(values.map(value=>C.parse(String(value))));

test('all built-in prefixes are calculated by actual Lambda reductions',()=>{
  for(const entry of S.builtins){const result=normal(parsed(S.program(entry.id,{count:'3'}).source));assert.ok(C.equal(result,list(entry.samples.slice(0,3))),entry.id);}
});
test('infinite streams are productive and consumers leave the remaining tail unevaluated',()=>{
  for(const [id,start,expected] of [[45,'4',3],[40,'3',5],[1477,'50',50]]){
    const stream=parsed(S.program(id,{start,infinite:true}).source);
    assert.equal(C.churchNumber(normal(C.A(stream,C.parse('λh.λt.h')))),expected);
  }
  const divergent=L.add([],'a401715','λn.(λx.x x) (λx.x x)');
  assert.ok(C.equal(normal(parsed(S.program(401715,{count:'0',functions:divergent}).source)),list([])));
  const zero=parsed(S.program(45,{count:'0'}).source);assert.ok(C.equal(normal(zero),list([])));
});
test('IDs, offsets, large counts and missing rules are handled without fabricated data',()=>{
  assert.equal(S.normalizeId(45),'A000045');assert.equal(S.normalizeId('a401715'),'A401715');
  for(const id of [0,401716,'1.5','../45'])assert.throws(()=>S.normalizeId(id));
  assert.throws(()=>S.program(1),/尚无内置生成规则/);assert.throws(()=>S.program(401715),/尚无内置生成规则/);
  assert.throws(()=>S.program(40,{start:'0'}),/从下标 1/);assert.throws(()=>S.program(45,{count:'-1'}));
  assert.match(S.program(45,{count:'999999999999999999999999'}).source,/999999999999999999999999_church$/);
  const custom=L.add([],'a401715','λn.λf.λx.f (n f x)');
  assert.ok(C.equal(normal(parsed(S.program(401715,{count:'4',functions:custom}).source)),list([1,2,3,4])));
  assert.equal(S.lookup(401715,custom).custom,true);
  const override=L.add([],'a000045','λn.n');assert.ok(C.equal(normal(parsed(S.program(45,{count:'3',functions:override}).source)),list([0,1,2])));
});
test('every sequence has an example and a derivation with closed, importable rule definitions',()=>{
  const P=require('../src/presets.js'),G=require('../src/guide.js');
  for(const entry of S.builtins){
    const example=P.examples.find(example=>example.sequenceId===entry.id),doc=G.lesson(example);assert.ok(example);assert.ok(doc.steps.length>=5);assert.match(doc.principle.join(' '),/没有预先生成/);
    const names=[...doc.core.matchAll(/^([^\s=]+)\s*=/gm)].map(match=>match[1]);
    const imported=L.importDefinitions([],doc.symbols,names);for(const fn of imported.functions)assert.equal(C.freeVars(fn.term).size,0);
    assert.equal(C.freeVars(parsed(P.inputSourceFor(example))).size,0);
  }
});
test('sequence rules and unfinished numeric/definition drafts survive snapshots',()=>{
  const snapshot=Default.create(),draft={id:'401715',start:'2',count:'1000',source:'λn.',open:true};
  snapshot.functions=L.add(snapshot.functions,'a401715','λn.n');snapshot.view.sequenceDraft=draft;
  const restored=Snapshot.decode(Snapshot.encode(snapshot));assert.deepEqual(restored.view.sequenceDraft,draft);assert.ok(restored.functions.some(fn=>fn.name==='a401715'));
  snapshot.view.sequenceDraft={...draft,count:3};assert.throws(()=>Snapshot.encode(snapshot),/草稿/);
});
