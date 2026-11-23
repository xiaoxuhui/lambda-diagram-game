const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),E=require('../src/data-encoding.js'),L=require('../src/library.js'),S=require('../src/snapshot.js'),Default=require('../src/default-state.js');
const deferred=(name='Box',source='λn.λk.k n')=>E.define([],name,source,undefined,null,{}, {reductionSteps:0});
test('deferred custom literals preserve their exact applications without any automatic reduction',async()=>{
  const entries=deferred(),step=C.step;let progressed=false;
  try{C.step=()=>{throw Error('must not reduce');};
    for(const [source,encoding] of [['0_Box','church'],['3_Box','church'],['3','custom:Box'],['λk.(λx.x) 3_Box','church']]){
      const parsed=E.parse(source,entries,Infinity,encoding),result=await E.compile(source,entries,encoding,{onProgress:()=>{progressed=true;}});
      assert.ok(C.equal(result.term,parsed.term));assert.equal(result.mappings.length,0);assert.equal(result.deferred.length,1);assert.ok(C.findRedex(result.term));
    }
  }finally{C.step=step;}
  assert.equal(progressed,false);
});
test('deferred inputs bypass previously normalized caches and keep the table when switching modes',async()=>{
  let entries=E.define([],'Box','λn.λk.k n');const normal=await E.compile('3_Box',entries);
  entries=E.putMapping(entries,'Box','3',normal.term);const original=entries[0];
  entries=E.define(entries,'Box',original.source,undefined,'Box',{}, {reductionSteps:0});assert.equal(entries[0].term,original.term);assert.equal(entries[0].table,original.table);
  const unready=await E.compile('3_Box',entries);assert.ok(C.findRedex(unready.term));assert.equal(unready.mappings.length,0);
  entries=E.define(entries,'Box',original.source,undefined,'Box',{}, {reductionSteps:null});const ready=await E.compile('3_Box',entries);assert.equal(C.findRedex(ready.term),null);assert.ok(C.equal(ready.term,normal.term));
});
test('different encodings can independently normalize or defer in one expression',async()=>{
  const entries=E.define(deferred(),'Auto','λn.λk.k n'),result=await E.compile('pair 2_Box 3_Auto',entries);
  assert.equal(result.mappings.length,1);assert.equal(result.mappings[0].name,'Auto');assert.equal(result.deferred.length,1);assert.equal(result.deferred[0].name,'Box');
  assert.ok(C.findRedex(result.term.fn.arg));assert.equal(C.findRedex(result.term.arg),null);
});
test('even a divergent converter can be entered without running and an ordinary converter reduces during execution',async()=>{
  const loop=deferred('Loop','λn.(λx.x x) (λx.x x)'),result=await E.compile('0_Loop',loop);assert.ok(C.findRedex(result.term));assert.equal(result.mappings.length,0);
  const entries=deferred(),compiled=await E.compile('3_Box',entries),reduced=C.normalize(compiled.term,100);assert.equal(reduced.status,'normal');assert.ok(C.equal(reduced.term,C.parse('λk.k 3')));
  const functions=L.add([],'boxthree','3_Box',Infinity,'church',6,entries,compiled);assert.ok(C.findRedex(functions[0].term));assert.ok(C.equal(C.normalize(functions[0].term,100).term,reduced.term));
});
test('encoding settings and unfinished setting edits survive archives, renames and input formats',()=>{
  let entries=E.withInputFormat(deferred(), 'Box','B{n}');entries=E.define(entries,'NewBox',entries[0].source,undefined,'Box');assert.equal(entries[0].reductionSteps,0);assert.equal(entries[0].inputFormat,'B{n}');
  const raw=Default.create();raw.dataEncodings=entries;raw.encodingDraft={name:'NewBox',source:entries[0].source,editing:'NewBox',reductionSteps:'0'};raw.view.numberEncoding='custom:NewBox';
  const saved=S.decode(S.encode(raw));assert.equal(saved.dataEncodings[0].reductionSteps,0);assert.equal(saved.encodingDraft.reductionSteps,'0');
  delete raw.dataEncodings[0].reductionSteps;delete raw.encodingDraft.reductionSteps;assert.equal(S.decode(S.encode(raw)).dataEncodings[0].reductionSteps,undefined);
  for(const invalid of [null,'no',0]){raw.dataEncodings[0].reduceInput=invalid;assert.throws(()=>S.encode(raw),/归约开关/);}
});
