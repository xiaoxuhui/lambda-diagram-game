const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),Lazy=require('../src/lazy-eval.js');

test('pair construction, selectors and every documented state update are complete runnable Lambda terms',async()=>{
  let lessons=0,expressions=0;
  for(const example of P.examples){
    const doc=G.lesson(example),raw=G.rawLesson(example);if(!doc.pairExamples)continue;lessons++;
    assert.ok(doc.pairExamples.length>=2,example.name);
    assert.ok(doc.pairExamples.every(item=>!/^第[0-9]+轮|^处理元素|^系数[0-9]/.test(item.label)),example.name);
    for(const [index,item] of doc.pairExamples.entries()){
      const label=example.name+': '+item.label,term=C.parse(item.source);
      assert.equal(item.name,undefined);
      assert.equal(C.freeVars(term).size,0,label);assert.ok(!/[0-9]|…|\.\.\./.test(item.source),label);
      assert.ok(C.equal(term,C.parse(raw.pairExamples[index].source)),label);
      const result=await Lazy.normalize(term,{signal:AbortSignal.timeout(5000),onPause:()=>true});
      assert.ok(C.equal(result,C.parse(item.expected)),label);
      assert.ok(item.compactSource&&item.compactSource.length<150,label+' has readable shorthand');
      const definitions=new Map(doc.symbols.map(symbol=>[symbol.name,C.parse(symbol.source)])),expanded=new Map();
      function expand(t){for(const name of C.freeVars(t)){if(!definitions.has(name))continue;if(!expanded.has(name))expanded.set(name,expand(definitions.get(name)));t=C.substitute(t,name,expanded.get(name));}return t;}
      const short=expand(C.parse(item.compactSource));assert.equal(C.freeVars(short).size,0,label+' shorthand dependencies are defined');
      const shortenedResult=await Lazy.normalize(short,{signal:AbortSignal.timeout(5000),onPause:()=>true});
      assert.ok(C.equal(shortenedResult,result),label+' shorthand preserves the actual result');expressions++;
    }
  }
  assert.equal(lessons,15);assert.equal(expressions,42);console.log('Verified pair lessons:',lessons,'complete expressions:',expressions);
});

test('pair examples use the actual preset state transition functions',()=>{
  const Ctor=C.parse('λa b k.k a b'),pair=(a,b)=>C.A(C.A(Ctor,C.parse(String(a))),C.parse(String(b)));
  const example=P.examples.find(e=>e.name.startsWith('阶乘 · 迭代')),doc=G.lesson(example);
  const body=C.parse(P.advanced.factorial).body,actualStep=body.fn.fn.arg;
  assert.ok(C.equal(C.parse(doc.pairExamples[1].source),C.A(C.A(C.parse('3'),actualStep),pair(0,1))));
  assert.ok(doc.core.includes('λn.'));assert.ok(doc.steps.every(step=>step[2]));
  const division=G.lesson(P.examples.find(e=>e.name.startsWith('序对除法')));
  assert.ok(division.pairExamples.some(item=>item.label.includes('7轮')));
  assert.ok(division.steps.some(step=>step[1].includes('剩下4轮')));
});

test('the factorial definition block defines every helper it uses and preserves its explanation',()=>{
  const example=P.examples.find(item=>item.name.startsWith('阶乘 · 迭代')),doc=G.lesson(example);
  const definitions=new Map(doc.core.split('\n').map(line=>{const [name,source]=line.split(' = ');return [name,C.parse(source)];}));
  assert.deepEqual([...definitions.keys()],['pair','true','false','succ','mul','facstep','fac']);
  for(const [name,term] of definitions)for(const dependency of C.freeVars(term))assert.ok(definitions.has(dependency),name+': '+dependency);
  let program=C.V('fac');for(const [name,term] of [...definitions].reverse())program=C.substitute(program,name,term);
  assert.ok(C.equal(program,C.parse(P.advanced.factorial)));
  assert.equal(doc.principle.length,2);assert.equal(doc.steps.length,5);
  assert.ok(doc.steps.some(step=>step[1].includes('每轮')));
  assert.equal(doc.pairExamples.length,3);
  assert.ok(!doc.pairExamples.some(item=>/第[0-9]+.*(?:轮|例子)/.test(item.label)));
});
