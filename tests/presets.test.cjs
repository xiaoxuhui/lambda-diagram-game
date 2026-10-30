const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),M=require('../src/polynomial.js'),D=require('../src/decimal.js');
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
  assert.equal(P.examples[6].name,'Ω · 无限循环');assert.equal(P.levels.length,30);
  assert.deepEqual(P.levels.slice(0,5).map(l=>[l.id,l.name]),[[1,'原样返回'],[2,'选择第一个'],[3,'翻转真假'],[4,'再走一步'],[5,'让函数相加']]);
});
for(const e of P.examples.filter(e=>e.expected!==undefined))test(`example reaches its stated result: ${e.name}`,()=>{
  const parsed=e.encoding==='decimal'?C.parseInput(e.term):C.parse(e.term);
  assert.equal(C.freeVars(parsed).size,0,e.name);
  assert.ok(e.category&&e.description);
  let value;if(e.encoding==='decimal'){value=parsed;for(let n=0;n<100000;n++){const r=C.step(value);if(!r)break;value=r.term;}assert.equal(C.findRedex(value),null);}
  else value=result(e.term);
  if(e.expectedType==='decimal')assert.equal(D.format(D.read(value)),e.expected,e.name);
  else if(e.expectedType==='polynomial')assert.equal(M.formatPolynomial(M.readPolynomial(value)),e.expected,e.name);
  else if(e.expectedType==='rational')assert.equal(M.formatRational(M.readRational(value)),e.expected,e.name);
  else assert.ok(C.equal(value,C.parse(e.expected)),e.name);
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
test('higher mathematics includes combinations and genuine symbolic calculus',()=>{
  const group=P.examples.filter(e=>e.category==='高等数学');assert.equal(group.length,13);
  assert.equal(P.examples[20].category,'高等数学');assert.equal(P.examples[21].name,'斐波那契 · F(5) → 5');
  for(const name of ['排列数','自然数求和','平方和','立方和','等比求和','系数和','二项式展开','多项式','符号求导','定积分','生成导函数','生成原函数'])assert.ok(group.some(e=>e.name.includes(name)),name);
});
test('finite folds handle zero terms and nontrivial inputs',()=>{
  for(const [formula,args,expected] of [
    [P.advanced.permutations,'4 0',1],[P.advanced.permutations,'3 4',0],[P.advanced.permutations,'5 2',20],
    [P.advanced.sumPowers?.(1),'0',0],[P.advanced.sumPowers?.(2),'2',5],[P.advanced.sumPowers?.(3),'2',9],
    [P.advanced.geometricSum,'2 0',0],[P.advanced.geometricSum,'0 3',1],[P.advanced.geometricSum,'3 3',13],
    [P.advanced.polynomial,'0',1],[P.advanced.polynomial,'3',28]
  ]){assert.equal(typeof formula,'string');assert.equal(C.churchNumber(result(`(${formula}) ${args}`)),expected,args);}
});
test('binomial expansion and original-polynomial calculus follow their formulas',()=>{
  for(const [formula,args,expected] of [
    [P.advanced.binomial,'2 3 0',1],[P.advanced.binomial,'2 1 2',9],
    [P.advanced.derivative,'0',3],[P.advanced.derivative,'1',5],[P.advanced.derivative,'3',9],
    [P.advanced.integral,'0 0',0],[P.advanced.integral,'1 3',8],[P.advanced.integral,'2 2',0]
  ]){assert.equal(typeof formula,'string');const value=result(`(${formula}) ${args}`);if(formula===P.advanced.binomial)assert.ok(C.equal(value,C.parse(String(expected))),args);else assert.equal(M.formatRational(M.readRational(value)),String(expected),args);}
});
