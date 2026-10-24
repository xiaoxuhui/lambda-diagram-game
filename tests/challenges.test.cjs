const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),H=require('../src/challenges.js'),D=require('../src/decimal.js');
test('six stages cover thirty unique levels in stable order',()=>{
  assert.equal(P.levels.length,30);assert.equal(P.stages.length,6);
  assert.deepEqual(P.levels.map(l=>l.id),Array.from({length:30},(_,i)=>i+1));
  assert.deepEqual(P.stages.flatMap(s=>s.levelIds),P.levels.map(l=>l.id));
  for(const stage of P.stages)assert.equal(stage.levelIds.length,5);
});
for(const level of P.levels)test(`challenge ${level.id} actually reduces to ${level.targetLabel}`,()=>{
  for(const key of ['name','topic','description','hint','target','targetLabel'])assert.ok(level[key],key);
  let term=H.compile(level),steps=0;assert.ok(!H.matches(level,term),'starting term still needs reduction');
  while(steps<100000){const next=C.step(term);if(!next)break;term=next.term;steps++;}
  assert.equal(C.findRedex(term),null,`test budget reached at level ${level.id}`);assert.ok(steps>0);
  assert.ok(H.matches(level,term),`wrong result at level ${level.id}`);
  assert.ok(!H.matches(level,C.parse('λx.λy.λz.z')),'unrelated result must fail');
  console.log(`Level ${level.id}: ${steps} beta steps`);
});
test('lambda targets accept alpha renaming but protect free variables',()=>{
  assert.ok(H.matches(P.levels[0],C.parse('λq.q')));
  assert.ok(H.matches(P.levels[9],C.parse('λq.y')));
  assert.ok(!H.matches(P.levels[9],C.parse('λy.y')));
  assert.ok(!H.matches(P.levels[0],C.parse('(λx.x) (λq.q)')));
});
test('decimal targets require exact values, reject approximation and accept trailing zeros',()=>{
  const level=P.levels[23];assert.ok(H.matches(level,D.encodeLiteral('0.125000')));
  assert.ok(!H.matches(level,D.encodeLiteral('0.12')));
  const value=D.encodeLiteral('0.125');
  // Change the encoded approximation flag while retaining the exact same digits.
  const mark=t=>t.type==='abs'?C.L(t.param,mark(t.body)):C.A(t.fn,C.parse('λt f.t'));
  assert.ok(!H.matches(level,mark(value)));
  assert.ok(!H.matches(level,C.parse('λx.x')));
});
