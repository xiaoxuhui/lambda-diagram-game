const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),A=require('../src/guide-advanced.js'),M=require('../src/polynomial.js'),D=require('../src/decimal.js'),Lazy=require('../src/lazy-eval.js');
const L=require('../src/library.js');
function teachingFunctions(symbols){
  const entries=new Map(symbols.map(s=>[s.name,C.parse(s.source)])),terms=new Map();
  function resolve(name){if(terms.has(name))return terms.get(name);let term=entries.get(name);for(const dep of C.freeVars(term))if(entries.has(dep))term=C.substitute(term,dep,resolve(dep));terms.set(name,term);return term;}
  return symbols.map(s=>({name:s.name,term:resolve(s.name)}));
}

test('every advanced math shorthand expands to the actual runnable example',()=>{
  for(const example of P.examples.filter(e=>e.category==='高等数学')){
    const doc=G.lesson(example);assert.ok(doc.inputs.length);assert.ok(doc.steps.length>=5);
    if(!doc.compact)continue;
    const functions=teachingFunctions(doc.symbols);
    const input=C.parse(doc.compact),publicEntries=example.metaInterpreter?functions.filter(fn=>G.libraryNames(doc).includes(fn.name)):functions;
    const term=example.metaInterpreter?G.compileInterpreterCall(input,publicEntries,value=>L.expand(value,publicEntries)):L.expand(input,functions);
    assert.deepEqual([...C.freeVars(term)].sort(),[...C.freeVars(C.parse(example.term))].sort(),example.name);
    if(/^(多项式|符号求导|生成导函数|生成原函数|定积分)/.test(example.name)){
      const actual=C.normalize(term,30000),expected=C.normalize(C.parse(example.term),30000);
      assert.equal(actual.status,'normal');assert.equal(expected.status,'normal');assert.ok(C.equal(actual.term,expected.term),example.name);
    }else assert.ok(C.equal(term,C.parse(example.term)),example.name);
  }
});

test('polynomial explanations use actual internal encoder, rational and calculus definitions',()=>{
  for(const [prefix,operation] of [['多项式','EVAL'],['符号求导','DERIVATIVE'],['定积分','DEFINITE'],['生成导函数','DIFF'],['生成原函数','INTEGRATE']]){
    const example=P.examples.find(e=>e.name.startsWith(prefix)),doc=G.rawLesson(example),actual=A.unpack(M.churchProgram(operation));
    assert.equal(doc.core.split('\n')[0],'主函数 = '+C.format(actual.main));
    for(const binding of actual.bindings){const symbol=doc.symbols.find(s=>s.name===binding.name);assert.ok(symbol?.meaning);assert.ok(C.equal(C.parse(symbol.source),binding.term));}
    assert.ok(doc.steps.some(step=>step[0].includes('抽出系数')));
    assert.ok(doc.steps.some(step=>step[0].includes('有理数')));
  }
  const derivative=G.lesson(P.examples.find(e=>e.name.startsWith('符号求导'))).steps.map(s=>s.join('\n')).join('\n');
  assert.match(derivative,/\[2\/1,3\/1\]/);assert.match(derivative,/2×2\+3=7/);
  const integral=G.lesson(P.examples.find(e=>e.name.startsWith('定积分'))).steps.map(s=>s.join('\n')).join('\n');
  assert.match(integral,/18\/2−0\/1/);assert.match(integral,/被积函数/);
});

test('polynomial teaching tables match actual Lambda division, derivative and integral state updates',async()=>{
  const expand=(operation,name)=>{
    let term=C.V(name);for(const binding of [...A.unpack(M.churchProgram(operation)).bindings].reverse())term=C.substitute(term,binding.name,binding.term);return term;
  };
  const normal=term=>Lazy.normalize(term,{signal:AbortSignal.timeout(5000),onPause:()=>true});
  const pairFields=term=>[term.body.fn.arg,term.body.arg];
  const listText=term=>'['+M.readPolynomial(term).map(([a,b])=>a+'/'+b).join(',')+']';
  for(const prefix of ['多项式','符号求导','定积分','生成导函数','生成原函数']){
    const doc=G.lesson(P.examples.find(e=>e.name.startsWith(prefix)));
    assert.ok(doc.flow.rows.length>=3);assert.match(doc.overview,/输入/);
    const rowStep=doc.steps.find(step=>step[0].includes('抽出系数'));
    const base=prefix==='多项式'?7:['定积分','生成原函数'].includes(prefix)?3:5;
    for(const row of rowStep[3].rows){
      const fn=expand('EVAL','divmod');
      const result=await normal(C.A(C.A(C.A(fn,C.parse(row[0])),C.parse(String(base))),C.parse('λq r.λk.k q r')));
      const fields=pairFields(result);assert.deepEqual(fields.map(term=>String(C.churchNumber(term))),row.slice(1,3));
    }
  }
  for(const [prefix,operation,name] of [['符号求导','DERIVATIVE','diff'],['定积分','DEFINITE','integ']]){
    const doc=G.lesson(P.examples.find(e=>e.name.startsWith(prefix))),algorithm=expand(operation,name);
    const step=algorithm.body.fn.fn.arg;let state=algorithm.body.fn.arg;
    const rows=doc.steps.find(item=>item[3]?.columns[0]==='从右侧读到的系数')[3].rows;
    for(const row of rows){
      const [numerator,denominator]=row[0].split('/');
      state=await normal(C.A(C.A(step,C.parse(`λk.k ${numerator} ${denominator}`)),state));
      const [degree,list]=pairFields(state),actual='('+C.churchNumber(degree)+','+listText(list)+')';
      assert.equal(actual,row[3]);
    }
  }
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
  const projected=new WeakMap();
  const unfoldPrecision=t=>{
    if(projected.has(t))return projected.get(t);
    let value=t;
    if(t.type==='abs')value=C.L(t.param,unfoldPrecision(t.body));
    else if(t.type==='app'){
      const fn=unfoldPrecision(t.fn),arg=unfoldPrecision(t.arg);
      value=fn.type==='abs'&&fn.param==='requested'?unfoldPrecision(C.substitute(fn.body,fn.param,arg)):C.A(fn,arg);
    }
    projected.set(t,value);return value;
  };
  for(const example of P.examples.filter(e=>e.decimalOperation)){
    const doc=G.rawLesson(example),actual=A.unpack(D.program(example.decimalOperation));
    const imported=teachingFunctions(doc.symbols);
    const expected=teachingFunctions(actual.bindings.map(b=>({name:b.name,source:C.format(b.term)})));
    for(const name of doc.featured){
      const binding=actual.bindings.find(b=>b.name===name);assert.ok(binding,example.name+': '+name);
      let term=imported.find(f=>f.name===name).term;
      if(doc.symbols.find(s=>s.name===name).precisionParameter)term=C.substitute(term.body,term.param,C.parse('6'));
      assert.ok(C.equal(unfoldPrecision(term),expected.find(f=>f.name===name).term),example.name+': '+name);
    }
  }
});

test('documented precision arguments and recurrence produce the requested decimal places',async()=>{
  for(const [operation,x,expected] of [['SIN','0.5','0.47'],['COS','0.5','0.87'],['SINH','-0.5','-0.52'],['COSH','0.5','1.12']]){
    const value=await Lazy.normalize(C.A(D.program(operation,2),D.encodeLiteral(x)),{signal:AbortSignal.timeout(10000),onPause:()=>true});
    assert.equal(D.format(D.read(value)),expected);
    const example=P.examples.find(e=>e.decimalOperation===operation),doc=G.lesson(example,2);
    assert.equal(doc.inputs[0].value,'2_church');
    assert.ok(doc.steps.some(step=>step[1].includes('requested+6')),operation);
    assert.ok(doc.steps.some(step=>step[2]?.includes('tₖ₊₁')),operation);
  }
});
