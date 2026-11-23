const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),L=require('../src/library.js');
test('the standalone successor example and its tutorial calculate n plus one',()=>{
  const example=P.examples.find(example=>example.successor);assert.equal(example.category,'基础数学');assert.equal(example.encoding,'church');
  const result=C.normalize(C.parse(example.term),1000);assert.equal(result.status,'normal');assert.equal(C.churchNumber(result.term),4);
  const doc=G.lesson(example);assert.match(doc.core,/^succ = λn\.λf\.λx\.f \(n f x\)$/);assert.equal(doc.compact,'succ 3');assert.equal(doc.steps.length,5);
  const imported=L.importDefinitions([],doc.symbols,['succ']).functions;
  for(const n of [0,1,3,12]){const result=C.normalize(L.expand(C.parse('succ '+n),imported),1000);assert.equal(result.status,'normal');assert.equal(C.churchNumber(result.term),n+1);}
});
