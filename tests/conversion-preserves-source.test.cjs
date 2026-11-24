const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),L=require('../src/library.js'),Compiler=require('../src/combinator-compiler.js'),F=require('../src/function-reduction.js');
test('the exact reported true application stays at zero beta steps in both preparation modes',()=>{
  const term=C.parse('(λtrue.true) (λa.λb.a)');assert.equal(P.preparePlain(term),term);const named=P.prepare(term);assert.equal(named.term,term);assert.equal(named.definitions.length,0);const step=C.step(term);assert.equal(step.param,'true');assert.ok(C.equal(step.term,C.parse('λa.λb.a')));
});
test('literal helper-looking binders are never guessed from their name, value, scope or use count',()=>{
  const samples=['(λtrue.z) (λa.λb.a)','λz.(λtrue.true) (λa.λb.a)','(λtrue.z) ((λx.x x) (λx.x x))','(λfalse.false) (λa.λb.b)',"(λid'.id') (λx.x)"];
  for(const entry of Compiler.catalog())samples.push('(λ'+entry.name+'.'+entry.name+') ('+entry.source+')','(λ'+entry.name+'.z) ('+entry.source+')');
  const step=C.step,normalize=C.normalize,substitute=C.substitute;
  try{C.step=C.normalize=C.substitute=()=>{throw Error('literal conversion must not substitute or run beta');};for(const source of samples){const term=C.parse(source);assert.equal(P.preparePlain(term),term,source);const prepared=P.prepare(term);assert.equal(prepared.term,term,source);assert.equal(prepared.definitions.length,0);}}
  finally{C.step=step;C.normalize=normalize;C.substitute=substitute;}
});
test('library and archive definitions containing the reported literal remain ordinary executable code',()=>{
  const source='λunused.(λtrue.true) (λa.λb.a)',functions=L.importDefinitions([],[{name:'keep',source}],null,{exact:true}).functions,term=L.expand(C.parse('keep value'),functions),prepared=P.preparePlain(term);assert.equal(prepared,term);const first=C.step(prepared),second=C.step(first.term);assert.equal(first.param,'unused');assert.equal(second.param,'true');assert.ok(C.equal(second.term,C.parse('λa.λb.a')));
});
test('only bindings freshly introduced by library expansion are eligible for invisible helper linking',()=>{
  const functions=L.importDefinitions([],[{name:'helper',source:'λz.z'},{name:'entry',source:'λx.helper x'}],['entry']).functions,term=L.expand(C.parse('entry value'),functions),prepared=P.preparePlain(term);assert.equal(C.step(prepared).param,'x');assert.ok(C.equal(C.step(prepared).term,C.parse('(λz.z) value')));assert.ok(C.equal(C.step(C.step(prepared).term).term,C.V('value')));
  const literal=C.parse(C.format(term));assert.equal(P.preparePlain(literal),literal,'identical printed text is still user code after parsing, not a trusted helper declaration');
  const named=P.prepare(term),reducer=F.create(named.definitions);let current=named.term;for(let i=0;i<20;i++){const next=reducer.step(current);if(!next)break;current=next.term;}assert.ok(C.equal(current,C.V('value')));
});
