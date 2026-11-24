const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),L=require('../src/library.js'),S=require('../src/snapshot.js'),Default=require('../src/default-state.js'),E=require('../src/data-encoding.js'),Lazy=require('../src/lazy-eval.js');
test('every example imports every displayed definition byte for byte and preserves it through archives',()=>{
  for(const example of P.examples){const doc=G.lesson(example),imported=L.importDefinitions([],doc.symbols,null,{exact:true}),state=Default.create();state.functions=imported.functions;const archive=S.encode(state),saved=S.decodeStartingState(archive);assert.equal(saved.functions.length,doc.symbols.length,example.name);for(const definition of doc.symbols){const fn=saved.functions.find(fn=>fn.name===definition.name);assert.equal(fn.source,definition.source,example.name+' '+definition.name);assert.equal(C.format(fn.term),C.format(C.parse(definition.source)));assert.equal(fn.named,true);}assert.equal(L.importDefinitions(saved.functions,doc.symbols,null,{exact:true}).added.length,0);}
});
test('strict imports reject even whitespace or alpha differences atomically unless replacement is selected',()=>{
  for(const source of ['λa.a',' λx.x','λx.x '])for(const collision of ['skip','rename','reuse']){const functions=L.add([],'id',source);assert.throws(()=>L.importDefinitions(functions,[{name:'new',source:'λx.x'},{name:'id',source:'λx.x'}],null,{exact:true,collision}),error=>error.conflicts.includes('id'));assert.equal(functions.length,1);assert.equal(functions[0].source,source);}
  const old=L.add([],'id','λx.other'),result=L.importDefinitions(old,[{name:'id',source:'λx.x'}],null,{exact:true,collision:'replace'});assert.equal(result.functions[0].source,'λx.x');assert.equal(old[0].source,'λx.other');assert.deepEqual(result.replaced,['id']);assert.match(L.importFeedback(result),/逐字核对/);
});
test('named dependencies preserve scope and converted expressions remain independent of later edits',()=>{
  const definitions=[{name:'id',source:'λx.x'},{name:'entry',source:'λid.λx.id x'}],functions=L.importDefinitions([],definitions,null,{exact:true}).functions;
  assert.ok(C.equal(C.normalize(L.expand(C.parse('entry (λx.x) 3'),functions),1000).term,C.parse('3')));
  const one=L.importDefinitions([],[{name:'use',source:'λx.x'},{name:'main',source:'λn.use n'}],null,{exact:true}).functions,prepared=L.expand(C.parse('main 4'),one),changed=L.update(one,'use','use','λx.9');assert.equal(C.churchNumber(C.normalize(prepared,1000).term),4);assert.equal(C.churchNumber(C.normalize(L.expand(C.parse('main 4'),changed),1000).term),9);
});
test('archives reject any discrepancy between named source, term and body instead of displaying a false definition',()=>{
  const state=Default.create();state.functions=L.importDefinitions([],[{name:'id',source:'λx.x'}],null,{exact:true}).functions;
  for(const field of ['term','body']){const raw=JSON.parse(S.encode(state));raw.functions[0][field]=C.parse('λa.a');assert.throws(()=>S.encode(raw),/不一致/);}
  const raw=JSON.parse(S.encode(state));raw.functions[0].source='λx.other';assert.throws(()=>S.decode(JSON.stringify(raw)),/不一致/);
});
for(const example of P.examples)test('exact definition set runs the unchanged example: '+example.name,async()=>{
  const doc=G.lesson(example,2),functions=L.importDefinitions([],doc.symbols,null,{exact:true}).functions,preserve=[...C.freeVars(E.parse(P.rawInputSourceFor(example,2)).term)],parsed=E.parse(doc.compact??P.inputSourceFor(example,2)).term,expand=term=>L.expand(term,functions,{preserve}),interpreted=G.compileInterpreterCall(parsed,functions,expand),term=P.preparePlain(interpreted===parsed?expand(parsed):interpreted);
  if(example.category==='归约与终止'){assert.equal(C.normalize(term,10).status,'cycle');return;}
  const a=await Lazy.normalize(term,{signal:AbortSignal.timeout(15000),growthWindowMs:0,onPause:()=>true}),b=await Lazy.normalize(E.parse(P.inputSourceFor(example,2)).term,{signal:AbortSignal.timeout(15000),growthWindowMs:0,onPause:()=>true});assert.ok(C.equal(a,b),example.name);
});
