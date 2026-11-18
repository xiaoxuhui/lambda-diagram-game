const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),A=require('../src/guide-advanced.js'),M=require('../src/polynomial.js'),D=require('../src/decimal.js'),Lazy=require('../src/lazy-eval.js');

test('every advanced math shorthand expands to the actual runnable example',()=>{
  for(const example of P.examples.filter(e=>e.category==='高等数学')){
    const doc=G.lesson(example);assert.ok(doc.inputs.length);assert.ok(doc.steps.length>=5);
    if(!doc.compact)continue;
    let term=C.parse(doc.compact);
    for(const symbol of [...doc.symbols].reverse())term=C.substitute(term,symbol.name,C.parse(symbol.source));
    assert.equal(C.freeVars(term).size,0,example.name);
    assert.ok(C.equal(term,C.parse(example.term)),example.name);
  }
});

test('polynomial explanations use actual internal encoder, rational and calculus definitions',()=>{
  for(const [prefix,operation] of [['多项式','EVAL'],['符号求导','DERIVATIVE'],['定积分','DEFINITE'],['生成导函数','DIFF'],['生成原函数','INTEGRATE']]){
    const example=P.examples.find(e=>e.name.startsWith(prefix)),doc=G.lesson(example),actual=A.unpack(M.churchProgram(operation));
    assert.equal(doc.core,'主函数 = '+C.format(actual.main));
    for(const binding of actual.bindings){const symbol=doc.symbols.find(s=>s.name===binding.name);assert.ok(symbol?.meaning);assert.ok(C.equal(C.parse(symbol.source),binding.term));}
    assert.ok(doc.steps.some(step=>step[0].includes('抽出系数')));
    assert.ok(doc.steps.some(step=>step[0].includes('有理数')));
  }
  const derivative=G.lesson(P.examples.find(e=>e.name.startsWith('符号求导'))).steps.map(s=>s.join('\n')).join('\n');
  assert.match(derivative,/\[2\/1,3\/1\]/);assert.match(derivative,/2×2\+3=7/);
  const integral=G.lesson(P.examples.find(e=>e.name.startsWith('定积分'))).steps.map(s=>s.join('\n')).join('\n');
  assert.match(integral,/18\/2−0\/1/);assert.match(integral,/原输入/);
});

test('later lessons have their own worked process and explicit typed inputs',()=>{
  const later=P.examples.filter(e=>['高等数学','高等小数','列表小数四则','丘奇列表'].includes(e.category));
  for(const example of later){
    const doc=G.lesson(example);assert.ok(doc.steps.length>=5,example.name);
    assert.ok(doc.steps.filter(step=>step[2]).length>=4,example.name);
    assert.ok(doc.steps.every(step=>!['确认输入的表示','找到最外层可以应用的 λ','跟踪每次替换后的状态'].includes(step[0])),example.name);
    assert.ok(doc.inputs.every(input=>input.name&&input.value&&input.encoding&&input.role),example.name);
    assert.ok(doc.symbols.every(symbol=>symbol.meaning&&symbol.source),example.name);
  }
  const power=G.lesson(P.examples.find(e=>e.decimalOperation==='POW'));
  assert.deepEqual(power.inputs.map(input=>input.encoding),['列表小数','丘奇自然数']);
  const list=G.lesson(P.examples.find(e=>e.name.includes('TAIL')));
  assert.match(list.encodingText,/Scott/);assert.match(list.steps.map(s=>s.join(' ')).join(' '),/\[2,3\]/);
});

test('all featured decimal helpers exist in the actual compiled program',()=>{
  for(const example of P.examples.filter(e=>e.decimalOperation)){
    const doc=G.lesson(example),actual=A.unpack(D.program(example.decimalOperation));
    for(const name of doc.featured){const binding=actual.bindings.find(b=>b.name===name);assert.ok(binding,example.name+': '+name);assert.ok(C.equal(C.parse(doc.symbols.find(s=>s.name===name).source),binding.term));}
  }
});

test('documented series working values match actual Lambda evaluation before final truncation',async()=>{
  for(const [operation,name,x,expected] of [['SIN','sinSeries','0.5','0.4794'],['COS','cosSeries','0.5','0.8776'],['SINH','sinhSeries','-0.5','-0.52105'],['COSH','coshSeries','0.5','1.1276']]){
    let term=C.V(name);for(const binding of [...A.unpack(D.program(operation)).bindings].reverse())term=C.substitute(term,binding.name,binding.term);
    const value=await Lazy.normalize(C.A(term,D.encodeLiteral(x)),{signal:AbortSignal.timeout(10000),onPause:()=>true});
    assert.equal(D.format(D.read(value)),expected);
    const example=P.examples.find(e=>e.decimalOperation===operation),doc=G.lesson(example);
    assert.ok(doc.steps.some(step=>step[2]?.includes(expected.replace('-','−'))),operation);
  }
});
