const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),M=require('../src/polynomial.js'),D=require('../src/decimal.js');
const E=require('../src/data-encoding.js'),Lazy=require('../src/lazy-eval.js');
const result=source=>{
  const r=C.normalize(C.parse(source),30000);
  assert.equal(r.status,'normal',source);
  return r.term;
};
test('advanced examples cover combinators, arithmetic, factorial, combinations and recursion',()=>{
  for(const name of ['组合子 B','乘法','乘方','阶乘','组合数','斐波那契'])assert.ok(P.examples.some(e=>e.name.includes(name)),name);
});
test('basic pair division returns remainder and quotient, including exact division and zero',()=>{
  const example=P.examples.find(e=>e.name.startsWith('序对除法'));
  assert.equal(example.category,'基础数学');
  const program=example.term.slice(0,-'7 2'.length);
  for(const [args,remainder,quotient] of [['7 2',1,3],['0 2',0,0],['2 7',2,0],['6 3',0,2],['9 4',1,2]]){
    assert.ok(C.equal(result(program+args),C.parse(`λk.k (${P.TRUE}) ${remainder} ${quotient}`)),args);
  }
  assert.equal(D.read(result(program+'7 0')).error,'除数不能为0');
});
test('Church list functions handle empty, singleton, custom mappings and ordered folds',()=>{
  const L=P.churchLists, list=L.encode, nil=`(${L.nil})`;
  const cases=[
    [`(${L.head}) ${nil} 7`,'7'],
    [`(${L.tail}) ${nil}`,L.nil],
    [`(${L.tail}) (${list([5])})`,L.nil],
    [`(${L.length}) ${nil}`,'0'],
    [`(${L.length}) (${list([0,0,0,0])})`,'4'],
    [`(${L.map}) (λx.x x) ${nil}`,L.nil],
    [`(${L.map}) (λx.λf z.x f (x f z)) (${list([1,2])})`,list([2,4])],
    [`(${L.append}) ${nil} (${list([2,1])})`,list([2,1])],
    [`(${L.append}) (${list([2,1])}) ${nil}`,list([2,1])],
    [`(${L.reverse}) ${nil}`,L.nil],
    [`(${L.reverse}) (${list([4])})`,list([4])],
    [`(${L.filter}) (λx.${P.TRUE}) (${list([1,2])})`,list([1,2])],
    [`(${L.filter}) (λx.${P.FALSE}) (${list([1,2])})`,L.nil],
    [`(${L.filter}) (λx.${P.TRUE}) ${nil}`,L.nil],
    [`(${list([1,2,3])}) (λh r.h) 0`,'1']
  ];
  for(const [source,expected] of cases)assert.ok(C.equal(result(source),C.parse(expected)),source);
});
test('the original choices and five challenges retain their identities after reordering',()=>{
  for(const name of ['Church 数字 2','加法 · 2 + 3','Ω · 无限循环'])assert.ok(P.examples.some(e=>e.name===name));
  assert.equal(P.levels.length,30);
  assert.deepEqual(P.levels.slice(0,5).map(l=>[l.id,l.name]),[[1,'原样返回'],[2,'选择第一个'],[3,'翻转真假'],[4,'再走一步'],[5,'让函数相加']]);
});
for(const e of P.examples.filter(e=>e.expected!==undefined))test(`example reaches its stated result: ${e.name}`,async()=>{
  const parsed=e.encoding==='decimal'?E.parse(P.inputSourceFor(e)).term:C.parse(e.term);
  assert.deepEqual([...C.freeVars(parsed)].sort(),e.metaInterpreter?[...C.freeVars(C.parse(e.metaInput))].sort():[],e.name);
  assert.ok(e.category&&e.description);
  let value;if(e.category==='高等小数')value=await Lazy.normalize(parsed,{signal:AbortSignal.timeout(15000),onPause:()=>true});
  else if(e.encoding==='decimal'){value=parsed;for(let n=0;n<100000;n++){const r=C.step(value);if(!r)break;value=r.term;}assert.equal(C.findRedex(value),null);}
  else value=result(e.term);
  if(e.expectedType==='decimal')assert.equal(D.format(D.read(value)),e.expected,e.name);
  else if(e.expectedType==='polynomial')assert.equal(M.formatPolynomial(M.readPolynomial(value)),e.expected,e.name);
  else if(e.expectedType==='rational')assert.equal(M.formatRational(M.readRational(value)),e.expected,e.name);
  else assert.ok(C.equal(value,C.parse(e.expected)),e.name);
});
test('scientific decimal programs respond to edits, including domain errors',async()=>{
  for(const [op,args,expected] of [
    ['POW',['-2_decimal','4_church'],'16'],
    ['SQRT',['4_decimal'],'2'],
    ['SQRT',['0.00000001_decimal'],'0.0001'],
    ['SQRT',['-1_decimal'],'实数平方根要求输入非负'],
    ['SIN',['-0.5_decimal'],'-0.479425'],
    ['SIN',['10_decimal'],'-0.544'],
    ['COS',['2_decimal'],'-0.416'],
    ['SIN',['1001_decimal'],'三角示例的角度范围是 −1000 到 1000 弧度'],
    ['SINH',['2_decimal'],'双曲示例的输入范围是 −1 到 1']
  ]){
    const term=E.parse(D.expression(op,args,(op==='SIN'&&args[0]==='10_decimal')||(op==='COS'&&args[0]==='2_decimal')?3:6)).term;
    // 慢机上 SIN(10) 单次求值约 15--20 秒，超时只用于防止跑飞。
    const value=await Lazy.normalize(term,{signal:AbortSignal.timeout(60000),onPause:()=>true});
    assert.equal(D.format(D.read(value)),expected,op+' '+args.join(' '));
  }
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
  const group=P.examples.filter(e=>e.category==='高等数学');assert.equal(group.length,22);
  assert.equal(P.examples.find(e=>e.name.startsWith('斐波那契')).category,'阶乘与递归');
  assert.equal(P.examples.find(e=>e.name.startsWith('整数除法')).category,'基础数学');
  for(const name of ['排列数','自然数求和','平方和','立方和','等比求和','系数和','二项式展开','多项式','符号求导','定积分','生成导函数','生成原函数','超幂','超超幂','开根号','对数','超对数','超根号','超超根号','超超对数'])assert.ok(group.some(e=>e.name.startsWith(name)||e.name.includes(name)),name);
});
test('inverse examples recalculate after changing operands and reject invalid inputs',()=>{
  for(const [name,oldArgs,args,expected] of [
    ['开根号','10 2','9 3','2'],
    ['整数除法','7 2','11 3','3'],
    ['对数','2 9','3 8','1'],
    ['超对数','2 16','2 15','2'],
    ['超根号','4 2','3 2','1'],
    ['超超对数','2 4','2 3','1'],
    ['对数','2 9','1 8',P.I],
    ['超超根号','4 2','4 0',P.I]
  ]){
    const {term}=P.examples.find(e=>e.name.startsWith(name+' ·'));
    assert.ok(term.endsWith(oldArgs));
    const value=result(term.slice(0,-oldArgs.length)+args);
    assert.ok(C.equal(value,C.parse(expected)),name+' '+args);
  }
  const divide=P.examples.find(e=>e.name.startsWith('整数除法')).term;
  assert.equal(D.read(result(divide.slice(0,-1)+'0')).error,'除数不能为0');
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
