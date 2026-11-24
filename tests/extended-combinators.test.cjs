const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),L=require('../src/library.js'),Compiler=require('../src/combinator-compiler.js');
const catalog=Compiler.catalog(),extended=catalog.filter(entry=>entry.extended),expand=result=>L.expand(result.term,result.definitions);
test('the expanded catalog has distinct closed definitions and direct compilation emits the requested primitive',async()=>{
  assert.equal(catalog.length,23);assert.equal(extended.length,17);assert.equal(new Set(catalog.map(entry=>entry.name)).size,catalog.length);
  for(const entry of catalog)assert.equal(C.freeVars(C.parse(entry.source)).size,0,entry.name);
  for(const entry of extended){const term=C.parse(entry.source),step=C.step,normalize=C.normalize;let compiled;
    try{C.step=C.normalize=()=>{throw Error('recognizing a combinator must not run it');};compiled=await Compiler.compileTerm(term,{signal:AbortSignal.timeout(3000)});}finally{C.step=step;C.normalize=normalize;}
    assert.equal(compiled.source,entry.name);assert.equal(compiled.definitions.length,1);assert.ok(C.equal(compiled.definitions[0].term,term));
    const alpha=C.parse(entry.source.replace(/[a-z]+/g,name=>'renamed'+name));assert.equal((await Compiler.compileTerm(alpha)).source,entry.name);
    const again=await Compiler.compileTerm(term,{functions:compiled.definitions});assert.equal(again.definitions.length,0);assert.equal(again.source,entry.name);
  }
});
test('new combinators execute their actual definitions on data, including finite recursive calls',async()=>{
  const i='(λx.x)',k='(λa.λb.a)',add='(λm.λn.λf.λx.m f (n f x))',succ='(λn.λf.λx.f (n f x))';
  const cases=[['m',i,'λx.x'],['a',i+' 7','7'],['t','7 '+i,'7'],['v','2 3 '+k,'2'],['q',succ+' '+succ+' 1','3'],['f','2 3 '+k,'3'],['r','2 '+k+' 3','3'],['d',add+' '+succ+' 2 4','7'],['e',add+' 2 '+succ+' 4','7'],['j',add+' 1 2 3','6'],['h','(λa.λb.λc.a) 2 3','2'],['l',i+' '+i,'λx.x'],['o',i+' '+i,'λx.x'],['phi',add+' '+succ+' '+succ+' 2','6'],['psi',add+' '+succ+' 2 3','7'],['y','(λr.λn.n) 3','3'],['z','(λr.λn.n) 3','3']];
  for(const [name,args,want]of cases){const entry=extended.find(entry=>entry.name===name),compiled=await Compiler.compileTerm(C.parse(entry.source)),term=L.expand(C.parse(name+' '+args),compiled.definitions),result=C.normalize(term,30000);assert.equal(result.status,'normal',name);assert.ok(C.equal(result.term,C.parse(want)),name);}
});
test('SK and BCKW never emit extended primitives, and ordinary mode still skips recognition',async()=>{
  for(const entry of extended){const term=C.parse(entry.source);
    const ordinary=await Compiler.compileTerm(term,{specialize:false});assert.ok(ordinary.used.every(name=>!extended.some(entry=>entry.name===name)),entry.name);
    for(const basis of ['sk','bckw']){const result=await Compiler.compileTerm(term,{basis,simplify:basis==='sk',signal:AbortSignal.timeout(3000)}),allowed=basis==='sk'?['s','k']:['b','c','k','w'];assert.ok(result.used.every(name=>allowed.includes(name)),entry.name+' '+basis);let original=term,actual=expand(result);if(['y','z'].includes(entry.name)){const f=C.parse('λr.λn.n');original=C.A(C.A(original,f),C.parse('3'));actual=C.A(C.A(actual,f),C.parse('3'));}const expected=C.normalize(original,30000),value=C.normalize(actual,30000);assert.equal(expected.status,'normal');assert.equal(value.status,'normal');assert.ok(C.equal(value.term,expected.term),entry.name+' '+basis);}
  }
});
test('expanded names follow every collision mode and other definitions remain private',async()=>{
  const original=L.add([],'phi','λx.x'),term=C.parse(extended.find(entry=>entry.name==='phi').source);
  await assert.rejects(Compiler.compileTerm(term,{functions:original}),/重名/);
  const rename=await Compiler.compileTerm(term,{functions:original,collision:'rename'});assert.equal(rename.source,'phi2');assert.ok(C.equal(expand(rename),term));
  const replace=await Compiler.compileTerm(term,{functions:original,collision:'replace'});assert.equal(replace.source,'phi');assert.ok(C.equal(replace.definitions[0].term,term));
  const reuse=await Compiler.compileTerm(term,{functions:original,collision:'reuse'});assert.equal(reuse.source,'phi');assert.deepEqual(reuse.reused,['phi']);assert.equal(reuse.definitions.length,0);assert.equal(C.format(original[0].term),'λx.x');
});
test('B I becomes A only in specialized full-combinator mode and retains the result lambdas',async()=>{
  const b=C.parse('λf.λg.λx.f (g x)'),i=C.parse('λx.x'),term=C.A(b,i),step=C.step,normalize=C.normalize;let result;
  try{C.step=C.normalize=()=>{throw Error('the structural rule must not evaluate');};result=await Compiler.compileTerm(term);}finally{C.step=step;C.normalize=normalize;}
  assert.equal(result.source,'a');assert.deepEqual(result.used,['a']);assert.ok(C.equal(C.normalize(expand(result),100).term,C.parse('λf.λx.f x')));assert.ok(!C.equal(expand(result),i));
  for(const argument of ['free','(λx.x)','(λa.λb.a)']){const input=C.A(term,C.parse(argument)),compiled=await Compiler.compileTerm(input);assert.ok(C.equal(C.normalize(expand(compiled),500).term,C.normalize(input,500).term));}
  assert.equal((await Compiler.compileTerm(C.parse('b i'))).source,'b i','unknown free names are not assumed to be primitives');
  const ordinary=await Compiler.compileTerm(term,{specialize:false});assert.ok(!ordinary.used.includes('a'));
  for(const basis of ['sk','bckw']){const restricted=await Compiler.compileTerm(term,{basis,simplify:basis==='sk'});assert.ok(!restricted.used.includes('a'));assert.ok(C.equal(C.normalize(expand(restricted),1000).term,C.parse('λf.λx.f x')));}
});
