const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../src/core.js'),M=require('../src/meta-lambda.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),L=require('../src/library.js'),Lazy=require('../src/lazy-eval.js');
const doc=G.lesson(P.examples.find(e=>e.metaInterpreter)),name=G.libraryNames(doc)[0],main=L.importDefinitions([],doc.symbols,[name]).functions[0];
const legacy={name,term:C.parse(fs.readFileSync(path.join(__dirname,'fixtures/interpret-two-arg.txt'),'utf8'))};
const pred='λn.λf.λx.n (λg.λh.h (g f)) (λu.x) i';
test('the public interpreter has one input and prepares the exact reported call without evaluating it',async()=>{
  assert.equal(main.term.type,'abs');assert.notEqual(main.term.body.type,'abs');assert.equal(doc.inputs.length,1);
  for(const entry of [main,legacy]){
    const functions=L.add([entry],'i','λx.x'),raw=C.parse(`${name} (${pred})`),step=C.step,normalize=C.normalize;let compiled;
    try{C.step=C.normalize=()=>{throw Error('encoding must not execute the input');};compiled=G.compileInterpreterCall(raw,functions,term=>L.expand(term,functions));}
    finally{C.step=step;C.normalize=normalize;}
    assert.notEqual(compiled,raw);assert.ok(M.isPipeline(compiled));assert.ok(M.isPipeline(P.preparePlain(compiled)));
    const expected=L.expand(C.parse(pred),functions),result=await Lazy.normalize(compiled,{signal:AbortSignal.timeout(15000)});assert.ok(C.equal(result,expected));
    const r=C.normalize(C.A(result,C.parse('3')),1000);assert.equal(C.churchNumber(r.term),2);
    const applied=G.compileInterpreterCall(C.parse(`${name} ((${pred}) 3)`),functions,t=>L.expand(t,functions));assert.equal(C.churchNumber(await Lazy.normalize(applied,{signal:AbortSignal.timeout(15000)})),2);
  }
});
test('undefined i stays free and a user-defined i keeps its own meaning',async()=>{
  for(const functions of [[main],L.add([main],'i','λa.λb.a')]){
    const parsed=C.parse(`${name} (${pred})`),term=G.compileInterpreterCall(parsed,functions,t=>L.expand(t,functions)),result=await Lazy.normalize(term,{signal:AbortSignal.timeout(15000)});
    assert.ok(C.equal(result,L.expand(C.parse(pred),functions)));assert.deepEqual([...C.freeVars(result)],[...C.freeVars(L.expand(C.parse(pred),functions))]);
  }
});
test('other user functions called interpret are not special-cased, while renamed genuine interpreters work',()=>{
  const user=L.add([],'interpret','λx.x'),raw=C.parse('interpret y');assert.equal(G.compileInterpreterCall(raw,user),raw);
  const renamed={...main,name:'myinterpreter'},call=C.parse('myinterpreter (λx.x)');assert.notEqual(G.compileInterpreterCall(call,[renamed]),call);
});
test('nested interpreter calls preserve local binding, shadowing and unused divergent branches',async()=>{
  const functions=L.add([main],'i','λx.x');
  for(const [source,expected]of [
    ['(λx.x) (interpret ((λx.x) y))','y'],
    ['(λi.interpret (i ((λx.x x) (λx.x x)))) (λignored.z)','z'],
    ['λi.interpret (λx.i)','λi.λx.i'],
    ['interpret ((λx.x) (interpret (λy.y)))','λy.y']
  ]){const parsed=C.parse(source),compiled=G.compileInterpreterCall(parsed,functions,t=>L.expand(t,functions));assert.notEqual(compiled,parsed);const result=await Lazy.normalize(compiled,{signal:AbortSignal.timeout(15000)});assert.ok(C.equal(result,C.parse(expected)),source);}
  const shadowed=C.parse('λinterpret.interpret x');assert.equal(G.compileInterpreterCall(shadowed,functions),shadowed);
});
