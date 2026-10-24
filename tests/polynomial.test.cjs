const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../src/core.js');
let M;try{M=require('../src/polynomial.js');}catch{}
const normal=source=>{const r=C.normalize(C.parse(source),100000);assert.equal(r.status,'normal');return r.term;};
test('symbolic operations are executable Lambda programs on original coefficient data',()=>{
 assert.ok(M,'missing symbolic calculus module');
 for(const [input,derivative,integral] of [[[0,3,1],'2x + 3','1/3x³ + 3/2x²'],[[0,2],'2','x²'],[[5],'0','5x'],[[0,0,3],'6x','x³'],[[0],'0','0']]){
  assert.equal(M.formatPolynomial(M.readPolynomial(normal(M.differentiate(input)))),derivative);
  assert.equal(M.formatPolynomial(M.readPolynomial(normal(M.integrate(input)))),integral);
 }
});
test('fraction coefficients survive differentiation and integration exactly',()=>{
 assert.ok(M);assert.equal(M.formatPolynomial(M.readPolynomial(normal(M.differentiate([0,[1,2],[1,3]])))),'2/3x + 1/2');
 assert.equal(M.formatPolynomial(M.readPolynomial(normal(M.integrate([0,1])))),'1/2x²');
});
test('integrate the original polynomial then evaluate both bounds',()=>{
 assert.ok(M);
 for(const [input,a,b,expected] of [[[0,2],0,3,'9'],[[0,1],0,1,'1/2'],[[3],1,3,'6'],[[0,0,3],0,2,'8'],[[0,3,1],0,1,'11/6'],[[0,2],2,2,'0']]){
  const source=M.definite(input,a,b);assert.ok(source.length<=C.LIMITS.chars);assert.equal(C.freeVars(C.parse(source)).size,0);
  assert.equal(M.formatRational(M.readRational(normal(source))),expected);
 }
});
test('generated functions, validation and recognition do not fake arbitrary expressions',()=>{
 assert.ok(M);const fn=M.derivativeAt([0,3,1]);for(const [x,v] of [[0,'3'],[2,'7'],[3,'9']])assert.equal(M.formatRational(M.readRational(normal(`(${fn}) ${x}`))),v);
 assert.throws(()=>M.polynomial([-1]),/系数/);assert.throws(()=>M.polynomial([[1,0]]),/系数/);assert.throws(()=>M.definite([1],2,1),/端点/);
 assert.equal(M.readRational(C.parse('λk.k 1 0')),null);assert.equal(M.readPolynomial(C.parse('λx.x')),null);
});
