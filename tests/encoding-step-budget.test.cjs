const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),E=require('../src/data-encoding.js'),S=require('../src/snapshot.js'),Default=require('../src/default-state.js');
const source='λn.(λa.λk.k a) ((λx.x) n)',entries=steps=>E.define([],'Steps',source,undefined,null,{}, {reductionSteps:steps});
const advance=(term,budget)=>{let steps=0;while(steps<budget){const next=C.step(term);if(!next)break;term=next.term;steps++;}return {term,steps};};
test('every literal performs exactly the requested number of available beta steps',async()=>{
  for(const budget of [0,1,2,3,20])for(const text of ['0_Steps','3_Steps','λk.(λx.x) 3_Steps']){
    const settings=entries(budget),parsed=E.parse(text,settings),reference=advance(parsed.literals[0].term,budget),result=await E.compile(text,settings),literal=[...result.deferred,...result.partial,...result.mappings][0];
    assert.equal(literal.steps,reference.steps);assert.ok(C.equal(literal.term,reference.term),text+' '+budget);
    if(text.startsWith('λ'))assert.equal(result.term.type,'abs','surrounding expressions are not evaluated');
    assert.equal(result.mappings.length,reference.steps===3?1:0);assert.equal(result.partial.length,budget===1||budget===2?1:0);
  }
});
test('finite budgets do not reuse a cached normal form or store partial results as mappings',async()=>{
  let settings=entries(null);const full=await E.compile('3_Steps',settings);assert.equal(C.findRedex(full.term),null);
  settings=E.putMapping(settings,'Steps','3',full.term);
  settings=E.define(settings,'Steps',source,undefined,'Steps',{}, {reductionSteps:1});const result=await E.compile('3_Steps',settings);
  assert.ok(C.findRedex(result.term));assert.equal(result.partial[0].steps,1);assert.equal(result.mappings.length,0);assert.equal(settings[0].table.length,1);
  assert.throws(()=>E.putMapping(settings,'Steps','4',result.term),/正规形/);
});
test('finite cyclic conversions stop at their step count without cycle rejection',async()=>{
  const settings=E.define([],'Loop','λn.(λx.x x) (λx.x x)',undefined,null,{}, {reductionSteps:5});
  const result=await E.compile('0_Loop',settings);assert.equal(result.partial[0].steps,5);assert.ok(C.findRedex(result.term));
});
test('budgets are independent per encoding and large budgets remain cancellable',async()=>{
  let settings=E.define(entries(1),'Other',source,undefined,null,{}, {reductionSteps:2});const result=await E.compile('pair 3_Steps 4_Other',settings);assert.deepEqual(result.partial.map(p=>p.steps),[1,2]);
  settings=E.define([],'Growing','λn.λf.(λx.f (x x)) (λx.f (x x))',undefined,null,{}, {reductionSteps:1000000});const controller=new AbortController();
  await assert.rejects(E.compile('0_Growing',settings,'church',{signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});
});
test('saved budgets and unfinished numeric drafts survive archives and legacy flags remain readable',async()=>{
  const raw=Default.create();raw.view.numberEncoding='church';raw.dataEncodings=entries(2);raw.encodingDraft={name:'Steps',source,editing:'Steps',reductionSteps:'12'};
  const restored=S.decode(S.encode(raw));assert.equal(restored.dataEncodings[0].reductionSteps,2);assert.equal(restored.encodingDraft.reductionSteps,'12');
  raw.dataEncodings=[{name:'Old',source:'λn.n',term:C.parse('λn.n'),reduceInput:false}];raw.encodingDraft={name:'Old',source:'λn.n',editing:'Old',reduceInput:false};const old=S.decode(S.encode(raw));assert.equal(E.reductionStepsFor(old.dataEncodings[0]),0);assert.ok(C.findRedex((await E.compile('3_Old',old.dataEncodings)).term));
  for(const invalid of [-1,1.5,NaN,'2',null])assert.throws(()=>E.validate([{name:'Bad',source,term:C.parse(source),reductionSteps:invalid}]),/步数/);
});
