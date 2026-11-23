const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),X=require('../src/list-operations.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),L=require('../src/library.js'),Lazy=require('../src/lazy-eval.js');
const normal=source=>Lazy.normalize(C.parse(source),{signal:AbortSignal.timeout(15000)});
async function check(name,args,expected){const result=await normal(X.program(name,args));assert.ok(C.equal(result,C.parse(expected)),name+' '+args.join(' '));return result;}
test('all list and binary examples compute their documented result with ordinary Lambda definitions',async()=>{
  for(const example of X.examples){assert.ok(P.examples.includes(example));const result=await normal(example.term);assert.ok(C.equal(result,C.parse(example.expected)),example.name);}
});
test('list lookup distinguishes element, first position, all positions and occurrence count',async()=>{
  for(const [name,args,want]of [
    ['nth',['[0,7,2]','1'],'0'],['nth',['[0,7,2]','2'],'7'],['nth',['[0,7,2]','0'],'0'],['nth',['[0,7,2]','4'],'0'],['nth',['[]','1'],'0'],
    ['indexof',['[0,7,0,7]','0'],'1'],['indexof',['[0,7,0,7]','7'],'2'],['indexof',['[0,7]','9'],'0'],['indexof',['[]','0'],'0'],
    ['positions',['[0,7,0,7]','0'],'[1,3]'],['positions',['[0,7]','9'],'[]'],['positions',['[]','0'],'[]'],
    ['contains',['[0,7]','0'],'λa.λb.a'],['contains',['[]','0'],'λa.λb.b'],['contains',['[0,7]','9'],'λa.λb.b'],
    ['count',['[0,7,0,7]','0'],'2'],['count',['[]','0'],'0'],['count',['[0,7]','9'],'0']
  ])await check(name,args,want);
});
test('last, init, take and drop preserve order and handle empty, singleton and excessive lengths',async()=>{
  for(const [name,args,want]of [
    ['last',['[]'],'0'],['last',['[0]'],'0'],['last',['[4,7,2]'],'2'],
    ['init',['[]'],'[]'],['init',['[4]'],'[]'],['init',['[4,7,2]'],'[4,7]'],
    ['take',['[4,7,2]','0'],'[]'],['take',['[4,7,2]','9'],'[4,7,2]'],['take',['[]','2'],'[]'],
    ['drop',['[4,7,2]','0'],'[4,7,2]'],['drop',['[4,7,2]','9'],'[]'],['drop',['[]','2'],'[]'],
    ['nth',['[(λx.x),z]','2'],'z'],['last',['[(λx.x),z]'],'z'],['init',['[(λx.x),z]'],'[(λx.x)]']
  ])await check(name,args,want);
});
const bits=(value,width)=>'['+value.toString(2).padStart(width??1,'0').split('').join(',')+']';
test('binary gates align low bits and preserve width, including every pair of three-bit inputs',async()=>{
  const gates={andbits:(a,b)=>a&b,orbits:(a,b)=>a|b,xorbits:(a,b)=>a^b,nandbits:(a,b)=>~(a&b)&7,norbits:(a,b)=>~(a|b)&7,xnorbits:(a,b)=>~(a^b)&7};
  for(let a=0;a<8;a++)for(let b=0;b<8;b++)for(const [gate,op]of Object.entries(gates))await check(gate,[bits(a,3),bits(b,3)],bits(op(a,b),3));
  for(const [name,args,want]of [['andbits',['[]','[1,0,1]'],'[0,0,0]'],['orbits',['[1]','[1,0]'],'[1,1]'],['xorbits',['[]','[]'],'[]'],['notbits',['[]'],'[]'],['notbits',['[0,0,1]'],'[1,1,0]']])await check(name,args,want);
});
test('multi-bit full addition covers carries, unequal widths, leading zeros and empty inputs',async()=>{
  for(let a=0;a<8;a++)for(let b=0;b<8;b++)await check('addbits',[bits(a,3),bits(b,3)],bits(a+b,Math.max(3,(a+b).toString(2).length)));
  await check('addbits',['[]','[]'],'[]');await check('addbits',['[]','[1,0]'],'[1,0]');await check('addbits',['[0,0,1]','[1]'],'[0,1,0]');
  await check('addbits',['['+Array(160).fill(1).join(',')+']','[1]'],'[1,'+Array(160).fill(0).join(',')+']');
});
test('Church/binary conversions round-trip, with canonical zero and leading-zero inputs',async()=>{
  await check('frombits',['[]'],'0');await check('frombits',['[0,0,1,0,1]'],'5');
  for(let n=0;n<=40;n++){await check('tobits',[String(n)],bits(n));await check('frombits',[bits(n)],String(n));}
  const source=X.program('frombits',['('+X.program('tobits',['37'])+')']);assert.equal(C.churchNumber(await normal(source)),37);
});
test('new tutorials import exactly one closed public entry and ordinary stepping uses the same computation',()=>{
  for(const example of X.examples){const doc=G.lesson(example),names=G.libraryNames(doc),imported=L.importDefinitions([],doc.symbols,names);assert.equal(imported.functions.length,1,example.name);assert.equal(C.freeVars(imported.functions[0].term).size,0);assert.equal(doc.inputs.length,example.listOperation.args.length);assert.ok(doc.steps.length>=5);assert.ok(doc.boundaries.length>=4);}
  for(const [name,args,want]of [['nth',['[4,7,2]','2'],'7'],['addbits',['[1,1]','[1]'],'[1,0,0]'],['tobits',['5'],'[1,0,1]']]){const result=C.normalize(C.parse(X.program(name,args)),30000);assert.equal(result.status,'normal');assert.ok(C.equal(result.term,C.parse(want)));}
});
test('pending calls use the actual definition and public inputs without supplying or evaluating arguments',()=>{
  const doc=G.lesson(X.examples.find(example=>example.listOperation.name==='nth')),functions=L.importDefinitions([],doc.symbols,G.libraryNames(doc)).functions;
  const partial=C.parse('nth [1,2,3]'),step=C.step,normalize=C.normalize;
  try{
    C.step=C.normalize=()=>{throw Error('call hints must not evaluate');};
    const hint=G.pendingCall(partial,functions);assert.equal(hint.supplied,1);assert.equal(hint.missing.length,1);assert.match(hint.message,/从1开始的序号/);assert.ok(C.equal(partial,C.parse('nth [1,2,3]')));
    assert.equal(G.pendingCall('nth [1,2,3] 2',functions),null);assert.equal(G.pendingCall('nth [1,2,3] 0',functions),null);
    assert.equal(G.pendingCall('nth [1,2,3]',[{name:'nth',term:C.parse('λx.x')}]),null);
    assert.equal(G.pendingCall('λnth.nth [1,2,3]',functions),null);assert.equal(G.pendingCall('unknown [1,2,3]',functions),null);
    assert.equal(G.pendingCall('pickitem [1,2,3]',[{...functions[0],name:'pickitem'}]).missing.length,1);
  }finally{C.step=step;C.normalize=normalize;}
});
