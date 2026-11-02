const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),E=require('../src/data-encoding.js'),D=require('../src/decimal.js'),L=require('../src/library.js'),S=require('../src/snapshot.js'),P=require('../src/presets.js');
const normalize=term=>{for(let n=0;n<50000;n++){const next=C.step(term);if(!next)return term;term=next.term;}assert.fail('test normalization budget');};
const box=()=>E.define([],'Box','λn.λk.k n');
test('unmarked numerals are Church and custom conversion remains an actual beta redex',()=>{
  assert.ok(C.equal(E.parse('3').term,C.parse('3')));
  const parsed=E.parse('3_Box',box());assert.deepEqual(parsed.encodings,['Box']);assert.equal(parsed.term.type,'app');
  assert.ok(C.equal(parsed.term.arg,C.parse('3')));assert.ok(C.findRedex(parsed.term));
  assert.ok(C.equal(normalize(parsed.term),C.parse('λk.k 3')));
});
test('custom encodings support Chinese names, multiple definitions, zero, and hygiene',()=>{
  const entries=E.define(box(),'我的数据','λn.λx.n');
  assert.ok(C.equal(normalize(E.parse('0_我的数据',entries).term),C.parse('λx.0')));
  assert.ok(C.equal(normalize(E.parse('(λx.3_Box) y',entries).term),C.parse('λk.k 3')));
  assert.ok(C.equal(normalize(E.parse('λk.2_Box',entries).term),C.parse('λa.λb.b 2')));
  assert.ok(C.equal(normalize(E.parse('900_church',entries).term),C.parse('900')));
});
test('mixed literals record actual encodings and leave variables containing digits untouched',()=>{
  const parsed=E.parse('λf.f 2 3_Box -0.5_decimal 1_丘奇数 2_列表小数 f2_Box',box());
  assert.deepEqual(parsed.encodings,['church','Box','decimal']);assert.ok(C.freeVars(parsed.term).has('f2_Box'));
  assert.equal(D.format(D.read(E.parse('-0.125_decimal').term)),'-0.125');
});
test('malformed suffixes, undefined names and invalid custom values have positions',()=>{
  for(const source of ['3_','3_Missing','-1_Box','0.5_Box','0.5','-1','1.2.3_Box']){
    assert.throws(()=>E.parse(source,box()),error=>error instanceof C.LambdaError&&Number.isInteger(error.position),source);
  }
  for(const name of ['decimal','church','丘奇数','列表小数','bad-name','2Bad',''])assert.throws(()=>E.define([],name,'λn.n'));
  assert.throws(()=>E.define([],'Open','λn.m'),/自由变量/);
  assert.throws(()=>E.define(box(),'Box','λn.n'),/已存在/);
});
test('saved converters expand library dependencies and redefinition is explicit',()=>{
  const library=L.add([],'WRAP','λn.λk.k n'),entries=E.define([],'Wrapped','WRAP',term=>L.expand(term,library));
  assert.equal(C.freeVars(entries[0].term).size,0);
  const old=E.parse('2_Wrapped',entries).term,redefined=E.define(entries,'Wrapped','λn.n',undefined,'Wrapped');
  assert.ok(C.equal(normalize(old),C.parse('λk.k 2')));
  assert.ok(C.equal(normalize(E.parse('2_Wrapped',redefined).term),C.parse('2')));
});
test('custom literals in saved functions keep their compiled meaning after encoding removal',()=>{
  const functions=L.add([],'VALUE','3_Box',Infinity,'church',6,box());
  assert.deepEqual(functions[0].encodings,['Box']);
  assert.deepEqual(L.encodingsFor(C.parse('VALUE'),functions),['Box']);
  assert.deepEqual(L.add(functions,'NESTED','VALUE',Infinity,'church',6,[]).at(-1).encodings,['Box']);
  assert.ok(C.equal(normalize(functions[0].term),C.parse('λk.k 3')));
  assert.ok(C.equal(L.update(functions,'VALUE','RENAMED','3_Box','church',6,[])[0].term,functions[0].term));
  assert.throws(()=>L.add([],'BAD','1_Missing',Infinity,'church',6,[]),/未定义/);
});
function sample(){return {version:2,draft:'3_Box',functions:[],dataEncodings:box(),encodingDraft:{name:'Box',source:'λn.λk.k n',editing:'Box'},completed:[],mode:'free',level:0,session:{original:E.parse('3_Box',box()).term,steps:1,dirty:false,halt:'',encodings:['Box']},view:{numberEncoding:'custom:Box',speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''};}
test('archives retain converter definitions, editing drafts, selection, provenance and replay',()=>{
  const raw=sample(),restored=S.decode(S.encodeBackup(raw,S.encode(raw)));
  assert.deepEqual(restored.dataEncodings,raw.dataEncodings);assert.deepEqual(restored.encodingDraft,raw.encodingDraft);
  assert.equal(restored.view.numberEncoding,'custom:Box');assert.deepEqual(restored.session.encodings,['Box']);
  assert.ok(C.equal(restored.term,C.parse('λk.k 3')));assert.equal(restored.history.length,2);
  assert.deepEqual(S.decode(restored.checkpointText).dataEncodings,raw.dataEncodings);
  raw.dataEncodings=[];raw.view.numberEncoding='church';raw.encodingDraft={name:'',source:''};
  assert.deepEqual(S.decode(S.encode(raw)).session.encodings,['Box']);
});
test('archives reject malformed or duplicate converters without evaluating user programs',()=>{
  for(const mutate of [raw=>raw.dataEncodings.push(raw.dataEncodings[0]),raw=>raw.dataEncodings[0].term=C.V('free'),raw=>raw.dataEncodings[0].source=3,raw=>raw.encodingDraft.editing='Missing',raw=>raw.view.numberEncoding='custom:Missing']){
    const raw=sample();mutate(raw);assert.throws(()=>S.decode(JSON.stringify(raw)));
  }
  assert.doesNotThrow(()=>E.define([],'Loop','(λx.x x) (λx.x x)'));
});
test('decimal examples explicitly annotate operands for the new editor parser',()=>{
  for(const example of P.examples.filter(e=>e.decimalOperation)){
    const parsed=E.parse(P.inputSourceFor(example));assert.deepEqual(parsed.encodings,['decimal']);
    assert.equal(D.format(D.read(normalize(parsed.term))),example.expected);
  }
});
