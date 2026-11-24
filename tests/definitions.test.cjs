const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),D=require('../src/definitions.js'),L=require('../src/library.js'),E=require('../src/data-encoding.js'),Decimal=require('../src/decimal.js');
test('name equals expression accepts multiple definitions and a main expression without altering old Lambda syntax',()=>{
  const source='id = λx.x\ndouble = λn.λf.λx.n f (n f x)\ndouble 3_church',parsed=D.parseProgram(source);assert.deepEqual(parsed.definitions.map(def=>def.name),['id','double']);assert.equal(parsed.expression,'double 3_church');assert.equal(parsed.definitions[0].source,'λx.x');
  assert.equal(D.parseProgram('id = λx.x').expression,null);assert.equal(D.parseProgram('λf.λx.\nf x').expression,'λf.λx.\nf x');assert.equal(D.parseProgram('`a=b` y').definitions.length,0);
  const wrapped=D.parseProgram('名前 = (\nλx.\nx\n)\n名前 y');assert.equal(wrapped.definitions.length,1);assert.equal(wrapped.expression,'名前 y');assert.equal(D.parseProgram('`a=b` = λx.x\n`a=b` y').definitions[0].name,'a=b');
  assert.throws(()=>D.parseProgram('foo ='),/等号后/);assert.throws(()=>D.parseProgram('foo = λx.x\nfoo y\nbar = λx.x'),/算式之前/);
});
test('sequential declarations preserve original source and compile data without running the main program',async()=>{
  const source='id = \\x.x\ndouble = λn.λf.λx.n f (n f x)\ncopy = λn.id (double n)\ncopy 3',step=C.step,normalize=C.normalize;let staged;
  try{C.step=C.normalize=()=>{throw Error('definitions must not execute functions');};staged=await D.prepare(source);}finally{C.step=step;C.normalize=normalize;}
  assert.deepEqual(staged.result.added,['id','double','copy']);assert.equal(staged.functions[0].source,'\\x.x');assert.equal(staged.functions[2].source,'λn.id (double n)');assert.ok(C.hasRedex(L.expand(staged.compiled.term,staged.functions)));
  const result=C.normalize(L.expand(staged.compiled.term,staged.functions),1000);assert.equal(result.status,'normal');assert.equal(C.churchNumber(result.term),6);
});
test('all collision choices apply to declarations and renamed references follow the new entry',async()=>{
  const old=L.add([],'f','λx.old'),source='f = λx.x\ng = λx.f x\ng 4';
  for(const collision of L.COLLISIONS){const staged=await D.prepare(source,old,{collision}),value=C.normalize(L.expand(staged.compiled.term,staged.functions),1000).term;assert.equal(C.format(old[0].term),'λx.old');if(['skip','reuse'].includes(collision))assert.equal(C.format(value),'old');else assert.equal(C.churchNumber(value),4);
    if(collision==='rename'){assert.equal(staged.aliases.get('f'),'f2');const again=await D.prepare(source,staged.functions,{collision});assert.equal(again.functions.length,staged.functions.length);assert.equal(C.churchNumber(C.normalize(L.expand(again.compiled.term,again.functions),1000).term),4);}
  }
  const reuse=await D.prepare('f = λ.\nf y',old,{collision:'reuse'});assert.deepEqual(reuse.result.reused,['f']);assert.equal(reuse.functions[0],old[0]);
});
test('aliases respect Lambda scope, reserve future declarations and do not capture free variables',async()=>{
  const old=L.add([],'f','λx.old'),staged=await D.prepare('f = λx.x\nf2 = λx.λy.x\ng = λf.f\ng 4',old,{collision:'rename'});assert.equal(staged.aliases.get('f'),'f3');assert.equal(C.churchNumber(C.normalize(L.expand(staged.compiled.term,staged.functions),1000).term),4);
  const scoped=await D.prepare('f = λx.x\ng = λf3.f\ng y',old,{collision:'rename'});assert.equal(C.churchNumber(C.normalize(C.A(L.expand(scoped.compiled.term,scoped.functions),C.parse('2')),1000).term),2);
});
test('invalid later definitions and main expressions leave the source library untouched',async()=>{
  const old=L.add([],'original','λx.x');await assert.rejects(D.prepare('good = λx.x\nbad = λx.',old));await assert.rejects(D.prepare('good = λx.x\n(',old));assert.equal(old.length,1);
  const only=await D.prepare('good = λx.x\nunfinished (',old,{compileExpression:false});assert.deepEqual(only.result.added,['good']);assert.equal(only.compiled,null);assert.equal(old.length,1);
});
test('number encodings and per-literal step settings remain in effect in definitions',async()=>{
  const decimal=await D.prepare('value = 0.125_decimal\nvalue');assert.equal(Decimal.format(Decimal.read(L.expand(decimal.compiled.term,decimal.functions))),'0.125');
  const encodings=E.define([],'Box','λn.(λx.λk.k x) n',undefined,null,{}, {reductionSteps:0}),boxed=await D.prepare('box = 2_Box\nbox',[],{encodings});assert.ok(C.hasRedex(boxed.functions[0].term));assert.equal(boxed.mappings.length,0);
  const controller=new AbortController();controller.abort();await assert.rejects(D.prepare('f = λx.x',[],{signal:controller.signal}),{name:'AbortError'});
  const custom=E.define([],'Data','λn.n',undefined,null,{}, {reductionSteps:0}),formatted=E.withInputFormat(custom,'Data','data={n}'),literal=await D.prepare('data=3',[],{encodings:formatted});assert.equal(literal.program.definitions.length,0);assert.equal(literal.functions.length,0);assert.ok(C.hasRedex(literal.compiled.term));
});
