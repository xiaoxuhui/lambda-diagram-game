const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),E=require('../src/data-encoding.js'),D=require('../src/decimal.js'),L=require('../src/library.js'),S=require('../src/snapshot.js');
const formats={church:'C{n}',decimal:'{n}d'};
const entries=()=>E.withInputFormat(E.define([],'Box','λn.λk.k n'),'Box','[{n}]');
const parse=(source,encoding='decimal')=>E.parse(source,entries(),Infinity,encoding,formats);
test('prefix, suffix and surrounding symbols select their explicit encodings',async()=>{
  assert.ok(C.equal(parse('C3').term,C.parse('3')));assert.deepEqual(parse('C3').encodings,['church']);
  assert.equal(D.format(D.read(parse('-1.25d').term)),'-1.25');
  const custom=await E.compile('[3]',entries(),'church',{numberFormats:formats});assert.ok(C.equal(custom.term,C.parse('λk.k 3')));assert.deepEqual(custom.encodings,['Box']);
  assert.ok(C.equal(parse('3_church').term,C.parse('3')));assert.equal(D.format(D.read(parse('0.5_decimal').term)),'0.5');
  assert.deepEqual(parse('λf.f C3 -0.5d [2]').encodings,['church','decimal','Box']);
});
test('word boundaries and binder scopes preserve ordinary variables',()=>{
  for(const source of ['C3foo','someC3','C3_extra','f2_Box'])assert.deepEqual([...C.freeVars(parse(source).term)],[source]);
  assert.ok(C.equal(parse('λC3.C3').term,C.parse('λx.x')));
  assert.ok(C.equal(parse('λC3.(λC3.C3) C3').term,C.parse('λx.(λy.y) x')));
  assert.deepEqual(parse('(λC3.C3) C3').encodings,['church']);
  assert.ok(C.equal(parse('λf.C3').term,C.parse('λf.3')));
});
test('letter suffix and punctuation templates coexist with application syntax',()=>{
  assert.ok(C.equal(E.parse('3c',[],Infinity,'decimal',{church:'{n}c'}).term,C.parse('3')));
  assert.ok(C.equal(parse('f[3]').term.fn,C.V('f')));
  const symbols=E.withInputFormat(entries(),'Box','#{n}!');assert.deepEqual(E.parse('#2!',symbols).encodings,['Box']);
  assert.ok(E.isLiteral('[3]',entries(),formats));assert.ok(E.isLiteral('C3',entries(),formats));assert.equal(E.isLiteral('λC3.C3',entries(),formats),false);
});
test('malformed, duplicate and reserved templates are rejected',()=>{
  for(const template of ['', '{n}', 'C{}','{n}{n}','C{n} x','λ{n}','({n})','{n}.'])assert.throws(()=>E.validateTemplate(template),undefined,template);
  assert.throws(()=>E.validateFormats(entries(),{church:'Q{n}',decimal:'Q{n}'}),/已被/);
  assert.throws(()=>E.withInputFormat(entries(),'Box','{n}_church'),/标准后缀/);
  assert.throws(()=>E.validateFormats(entries(),{church:'[{n}]'}),/已被/);
  assert.throws(()=>E.validateFormats(entries(),{unknown:'Q{n}'}),/不合法/);
  assert.throws(()=>E.parse('C03',[],Infinity,'church',{church:'C{n}',decimal:'C0{n}'}),/同时匹配/);
});
test('encoding values retain their existing domains and standard suffixes override the current menu',()=>{
  assert.throws(()=>parse('C0.5'),/非负整数/);assert.throws(()=>parse('[-1]'),/非负整数/);
  assert.ok(C.equal(parse('3_丘奇数','custom:Box').term,C.parse('3')));
  assert.equal(D.format(D.read(parse('3','decimal').term)),'3');
});
test('renaming preserves explicit templates, value tables and unchanged function meaning',async()=>{
  let registry=E.putMapping(entries(),'Box','3',C.parse('λk.k 3'));
  registry=E.define(registry,'Wrapped',registry[0].source,undefined,'Box',formats);assert.equal(registry[0].inputFormat,'[{n}]');assert.equal(registry[0].table.length,1);
  const compiled=await E.compile('[3]',registry,'church',{numberFormats:formats});
  const functions=L.add([],'VALUE','[3]',Infinity,'church',6,registry,compiled);
  assert.deepEqual(functions[0].sourceFree,[]);assert.equal(L.update(functions,'VALUE','RENAMED','[3]','church',6,[])[0].term,functions[0].term);
});
function sample(){return {version:2,draft:'C3',functions:[],dataEncodings:entries(),encodingDraft:{name:'',source:''},completed:[],mode:'free',level:0,session:{original:C.parse('3'),steps:0,dirty:false,halt:'',encodings:['church']},view:{numberEncoding:'church',numberFormats:formats,inputFormatDraft:{encoding:'church',text:'Draft{n}'},speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''};}
test('archives preserve builtin/custom formats and unfinished input-format drafts',()=>{
  const raw=sample(),restored=S.decode(S.encodeBackup(raw,S.encode(raw)));
  assert.deepEqual(restored.view.numberFormats,formats);assert.deepEqual(restored.view.inputFormatDraft,raw.view.inputFormatDraft);assert.equal(restored.dataEncodings[0].inputFormat,'[{n}]');
  assert.deepEqual(S.decode(restored.checkpointText).view.numberFormats,formats);
  raw.view.numberFormats={church:'[{n}]'};assert.throws(()=>S.encode(raw),/已被/);
});
test('converter definitions can use registered input formats without introducing free variables',()=>{
  const registry=E.define(entries(),'Constant','λn.C3',undefined,null,formats);assert.equal(C.freeVars(registry.at(-1).term).size,0);
});
