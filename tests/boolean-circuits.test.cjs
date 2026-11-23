const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),B=require('../src/boolean-circuits.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),L=require('../src/library.js'),E=require('../src/data-encoding.js');
const truth=b=>b?'(λa.λb.a)':'(λa.λb.b)',normal=source=>{const r=C.normalize(C.parse(source),100000);assert.equal(r.status,'normal');return r.term;};
const run=(name,args)=>normal(B.program(name,args.map(value=>typeof value==='boolean'?truth(value):String(value))));
test('all single and two-input gates match their complete truth tables',()=>{
  for(const [name,fn] of Object.entries({andgate:(a,b)=>a&&b,orgate:(a,b)=>a||b,nand:(a,b)=>!(a&&b),nor:(a,b)=>!(a||b),xorgate:(a,b)=>a!==b,xnor:(a,b)=>a===b,implies:(a,b)=>!a||b}))for(const a of [false,true])for(const b of [false,true])assert.ok(C.equal(run(name,[a,b]),C.parse(truth(fn(a,b)))),name);
  for(const b of [false,true])assert.ok(C.equal(run('notgate',[b]),C.parse(truth(!b))));
});
test('half and full adders produce sum/carry pairs for every input combination',()=>{
  for(const a of [false,true])for(const b of [false,true])for(const c of [false,true]){
    const total=Number(a)+Number(b)+Number(c),full=run('fulladd',[a,b,c]);
    assert.equal(B.read(full),`（${total%2?'真':'假'}，${total>1?'真':'假'}）`);
    const half=run('halfadd',[a,b]);assert.equal(B.read(half),`（${a!==b?'真':'假'}，${a&&b?'真':'假'}）`);
  }
});
test('mux, demux and nested comparison outputs preserve bit order',()=>{
  for(const s of [false,true])for(const a of [false,true])for(const b of [false,true]){
    assert.ok(C.equal(run('mux',[s,a,b]),C.parse(truth(s?b:a))));
    assert.equal(B.read(run('demux',[s,a])),`（${!s&&a?'真':'假'}，${s&&a?'真':'假'}）`);
    assert.equal(B.read(run('bitcmp',[a,b])),`（${a&&!b?'真':'假'}，（${a===b?'真':'假'}，${!a&&b?'真':'假'}））`);
  }
});
test('serial functions consume the specified number of inputs and preserve list order',()=>{
  for(const bits of [[],[true],[false,true],[true,false,true,true,false,true],Array.from({length:12},(_,i)=>i%3===0)]){
    const expected=values=>'['+values.map(v=>v?'真':'假').join('，')+']';
    const list=run('bits',[bits.length,...bits]);if(bits.length)assert.equal(B.read(list),expected(bits));else assert.ok(C.equal(list,C.parse('λc.λn.n')));
    for(const initial of [false,true]){const out=run('delayi',[bits.length,initial,...bits]);if(bits.length)assert.equal(B.read(out),expected([initial,...bits.slice(0,-1)]));else assert.ok(C.equal(out,C.parse('λc.λn.n')));}
    assert.ok(C.equal(run('allbits',[bits.length,...bits]),C.parse(truth(bits.every(Boolean)))));
    assert.ok(C.equal(run('anybits',[bits.length,...bits]),C.parse(truth(bits.some(Boolean)))));
    assert.ok(C.equal(run('parity',[bits.length,...bits]),C.parse(truth(bits.filter(Boolean).length%2===1))));
  }
  const partial=run('delay',[6,true,false]);assert.equal(partial.type,'abs','missing inputs leave an ordinary waiting function');
  for(let position=0;position<=8;position++)assert.ok(C.equal(run('delayat',[6,position,true,false,true,true,false,true]),C.parse(truth([false,true,false,true,true,false][position-1]??false))),String(position));
});
test('all circuit examples, guides and imported entry functions perform the same actual computation',()=>{
  for(const example of B.examples){
    const doc=G.lesson(example),names=G.libraryNames(doc),imported=L.importDefinitions([],doc.symbols,names);
    assert.equal(names.length,1,example.name);assert.equal(imported.functions.length,1);
    assert.ok(doc.steps.length>=5);assert.ok(doc.flow.rows.length>=2);assert.ok(doc.inputs.length);
    assert.ok(C.equal(normal(example.term),C.parse(example.expected)),example.name);
    const parsed=E.parse(doc.compact).term,value=C.normalize(L.expand(parsed,imported.functions),100000);assert.equal(value.status,'normal');assert.ok(C.equal(value.term,C.parse(example.expected)),example.name+' imported');
    const source=E.parse(P.inputSourceFor(example)).term,plain=P.preparePlain(source);assert.equal(C.freeVars(plain).size,0);assert.ok(C.equal(C.normalize(plain,100000).term,C.parse(example.expected)));
  }
});
