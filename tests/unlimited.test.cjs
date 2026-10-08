const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js');
const POWER='(λb e.e b) 2 10';
const Y='λf.(λx.f (x x)) (λx.f (x x))';
const ZERO='λn.n (λx.λt f.f) (λt f.t)';
const PRED='λn f x.n (λg h.h (g f)) (λu.x) (λu.u)';
const MULT='λm n f.m (n f)';
const FACTORIAL=`(${Y}) (λr n.(${ZERO}) n 1 ((${MULT}) n (r ((${PRED}) n)))) 3`;
for(const [name,source,answer] of [['2^10',POWER,1024],['3!',FACTORIAL,6]]) {
  test(`${name} completes without fixed node/depth/200-step cutoff`,()=>{
    const r=C.normalize(C.parse(source),20000);
    assert.equal(r.status,'normal');assert.equal(C.churchNumber(r.term),answer);
    console.log(`${name}: ${r.steps} beta reductions, ${C.inspect(r.term).nodes} final nodes`);
  });
}
module.exports={POWER,FACTORIAL};
