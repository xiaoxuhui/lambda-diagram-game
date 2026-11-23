const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),L=require('../src/library.js'),E=require('../src/data-encoding.js'),D=require('../src/decimal.js'),Lazy=require('../src/lazy-eval.js'),S=require('../src/snapshot.js'),Default=require('../src/default-state.js');
test('every lesson has an audited public contract and imports only its self-contained entry',()=>{
  const snapshot=Default.create();
  for(const example of P.examples){
    const doc=G.lesson(example),contract=doc.entryContract,names=G.libraryNames(doc);assert.ok(contract,example.name);
    if(!contract.name){assert.equal(example.name,'Church 数字 2');continue;}
    assert.deepEqual(names,[contract.name],example.name);const imported=L.importDefinitions([],doc.symbols,names);assert.equal(imported.functions.length,1);
    assert.equal(C.freeVars(imported.functions[0].term).size,0,example.name);assert.ok(doc.compact);assert.ok(Array.isArray(doc.inputs));
    snapshot.functions=imported.functions;assert.equal(S.decode(S.encode(snapshot)).functions.length,1,example.name+' archive');
    assert.deepEqual(L.importDefinitions(imported.functions,doc.symbols,names).ready,names);
    if(!example.booleanCircuit&&!example.sequenceId&&!example.metaInterpreter&&!example.capsule&&!example.fixedNumerator&&contract.kind==='function')assert.equal(doc.inputs.length,P.callParts(example).args.length,example.name);
  }
});
for(const example of P.examples)test('single-entry call agrees with the complete program: '+example.name,async()=>{
  const precision=2,doc=G.lesson(example,precision),names=G.libraryNames(doc);if(!names.length)return;
  const imported=L.importDefinitions([],doc.symbols,names),parsed=E.parse(doc.compact).term;
  const call=example.metaInterpreter?G.compileInterpreterCall(parsed,imported.functions,t=>L.expand(t,imported.functions)):L.expand(parsed,imported.functions);
  if(example.category==='归约与终止'){assert.equal(C.normalize(call,10).status,'cycle');return;}
  const reference=E.parse(P.inputSourceFor(example,precision)).term;
  const normalize=term=>Lazy.normalize(term,{signal:AbortSignal.timeout(15000),onPause:()=>true});
  const actual=await normalize(P.preparePlain(call)),expected=await normalize(reference);assert.ok(C.equal(actual,expected),example.name);
});
test('fixed numerator and binomial bases stay private while real operands and precision remain editable',async()=>{
  const cases=[['二项式系数和','binomsum 0',1],['二项式系数和','binomsum 2',4],['二项式系数和','binomsum 4',16],['倒数','reciprocal 2_church 0.5_decimal','2'],['倒数','reciprocal 2_church 3_decimal','0.33'],['倒数','reciprocal 0_church 2_decimal','0']];
  for(const [prefix,source,want]of cases){const doc=G.lesson(P.examples.find(example=>example.name.startsWith(prefix))),functions=L.importDefinitions([],doc.symbols,G.libraryNames(doc)).functions;const result=await Lazy.normalize(L.expand(E.parse(source).term,functions),{signal:AbortSignal.timeout(15000)});assert.equal(typeof want==='number'?C.churchNumber(result):D.format(D.read(result)),want);}
});
test('a library assembled from every public entry needs no extra helper entries',()=>{
  let functions=[];const selected=new Set();for(const example of P.examples){const doc=G.lesson(example),names=G.libraryNames(doc);functions=L.importDefinitions(functions,doc.symbols,names).functions;names.forEach(name=>selected.add(name));}
  assert.deepEqual(new Set(functions.map(fn=>fn.name)),selected);assert.ok(functions.every(fn=>C.freeVars(fn.term).size===0));
});
