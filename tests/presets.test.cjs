const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js');
const result=source=>{
  const r=C.normalize(C.parse(source),30000);
  assert.equal(r.status,'normal',source);
  return r.term;
};
test('advanced examples cover combinators, arithmetic, factorial, combinations and recursion',()=>{
  for(const name of ['组合子 B','乘法','乘方','阶乘','组合数','斐波那契'])assert.ok(P.examples.some(e=>e.name.includes(name)),name);
});
test('the original eight choices and five challenges retain their identities',()=>{
  assert.equal(P.examples[3].name,'Church 数字 2');assert.equal(P.examples[5].name,'加法 · 2 + 3');
  assert.equal(P.examples[6].name,'Ω · 无限循环');assert.equal(P.levels.length,5);
});
for(const e of P.examples.filter(e=>e.expected!==undefined))test(`example reaches its stated result: ${e.name}`,()=>{
  assert.equal(C.freeVars(C.parse(e.term)).size,0,e.name);
  assert.ok(e.category&&e.description);
  assert.ok(C.equal(result(e.term),C.parse(e.expected)),e.name);
});
test('iterative and recursive factorial handle zero, one and four',()=>{
  for(const formula of [P.advanced?.factorial,P.advanced?.recursiveFactorial]){
    assert.equal(typeof formula,'string');
    for(const [n,expected] of [[0,1],[1,1],[4,24]])assert.equal(C.churchNumber(result(`(${formula}) ${n}`)),expected);
  }
});
test('Pascal combinations handle edges, symmetry and k greater than n',()=>{
  assert.equal(typeof P.advanced?.choose,'string');
  for(const [n,k,expected] of [[0,0,1],[3,0,1],[3,3,1],[3,4,0],[4,1,4],[4,3,4],[4,2,6]])
    assert.equal(C.churchNumber(result(`(${P.advanced.choose}) ${n} ${k}`)),expected,`C(${n},${k})`);
});
