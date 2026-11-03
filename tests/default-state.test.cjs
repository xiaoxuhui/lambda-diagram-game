const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),E=require('../src/data-encoding.js'),L=require('../src/library.js'),S=require('../src/snapshot.js'),D=require('../src/default-state.js');
const list=items=>C.L('c',C.L('n',items.reduceRight((tail,head)=>C.A(C.A(C.V('c'),head),tail),C.V('n'))));
const ordinal=number=>list(Array.from({length:number},(_,index)=>ordinal(index)));
const run=async(snapshot,source)=>{
  const parsed=await E.compile(source,snapshot.dataEncodings,'custom:Set'),expanded=L.expand(parsed.term,snapshot.functions),result=C.normalize(expanded,100000);
  assert.equal(result.status,'normal');return result.term;
};
test('default archive contains a complete editable function library and a paused manual-conversion draft',()=>{
  const snapshot=D.create();assert.equal(snapshot.functions.length,15);assert.equal(snapshot.draft,'SET_ADD 1_Set 2_Set');assert.equal(snapshot.session.original,null);assert.equal(snapshot.session.steps,0);assert.equal(snapshot.mode,'free');assert.deepEqual(snapshot.completed,[]);
  assert.equal(snapshot.view.numberEncoding,'custom:Set');assert.equal(snapshot.dataEncodings[0].inputFormat,'s{n}');assert.equal(snapshot.dataEncodings[0].table.length,6);
  for(const fn of snapshot.functions){assert.equal(typeof fn.source,'string');assert.equal(C.freeVars(fn.term).size,0,fn.name);}
  assert.equal(snapshot.functions.find(fn=>fn.name==='SET_SUCC').source,'λs.LIST_APPEND s (LIST_ONE s)');
  assert.doesNotThrow(()=>S.decode(S.encode(snapshot)));
});
test('zero is empty and every successor appends the entire prior list as one element',async()=>{
  const snapshot=D.create();
  for(const number of [0,1,2,3,4,5])assert.ok(C.equal(snapshot.dataEncodings[0].table[number].term,ordinal(number)),String(number));
  for(const number of [0,1,2])assert.ok(C.equal(await run(snapshot,`SET_SUCC ${number}_Set`),ordinal(number+1)));
  assert.ok(C.equal(await run(snapshot,'SET_ZERO'),list([])));
});
test('list concatenation, extraction, tail and empty tests are actual Lambda calculations',async()=>{
  const snapshot=D.create();
  assert.ok(C.equal(await run(snapshot,'LIST_APPEND (LIST_ONE 0_Set) (LIST_ONE 1_Set)'),ordinal(2)));
  assert.ok(C.equal(await run(snapshot,'LIST_HEAD 2_Set SET_ZERO'),ordinal(0)));
  assert.ok(C.equal(await run(snapshot,'LIST_TAIL 2_Set'),list([ordinal(1)])));
  assert.ok(C.equal(await run(snapshot,'LIST_IS_EMPTY 0_Set'),C.parse('λx y.x')));
  assert.ok(C.equal(await run(snapshot,'LIST_IS_EMPTY 1_Set'),C.parse('λx y.y')));
});
test('Church conversion, addition and multiplication produce the matching set-list numbers',async()=>{
  const snapshot=D.create();
  for(const number of [0,1,3]){
    assert.ok(C.equal(await run(snapshot,`SET_FROM_CHURCH ${number}_church`),ordinal(number)));
    assert.ok(C.equal(await run(snapshot,`SET_TO_CHURCH ${number}_Set`),C.parse(String(number))));
  }
  for(const [source,value] of [['SET_ADD 0_Set 2_Set',2],['SET_ADD 1_Set 2_Set',3],['SET_ADD 2_Set 1_Set',3],['SET_MUL 0_Set 2_Set',0],['SET_MUL 2_Set 2_Set',4]]){
    const result=await run(snapshot,source);assert.ok(C.equal(result,ordinal(value)),source);assert.deepEqual(E.lookup(result,snapshot.dataEncodings,['Set']),[{name:'Set',number:String(value)}]);
  }
});
test('default state creation is independent of prior loaded or edited copies',()=>{
  const first=D.create();first.functions[0].source='changed';first.dataEncodings[0].table.pop();first.completed.push(1);
  const next=D.create();assert.equal(next.functions[0].source,'λn f x.f (n f x)');assert.equal(next.dataEncodings[0].table.length,6);assert.deepEqual(next.completed,[]);
});
