const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),E=require('../src/data-encoding.js'),D=require('../src/decimal.js'),L=require('../src/library.js'),S=require('../src/snapshot.js'),P=require('../src/presets.js');
const normalize=term=>{for(let n=0;n<50000;n++){const next=C.step(term);if(!next)return term;term=next.term;}assert.fail('test normalization budget');};
const box=()=>E.define([],'Box','λn.λk.k n');
test('raw parser represents a custom conversion as a beta redex before automatic compilation',()=>{
  assert.ok(C.equal(E.parse('3').term,C.parse('3')));
  const parsed=E.parse('3_Box',box());assert.deepEqual(parsed.encodings,['Box']);assert.equal(parsed.term.type,'app');
  assert.ok(C.equal(parsed.term.arg,C.parse('3')));assert.ok(C.findRedex(parsed.term));
  assert.ok(C.equal(normalize(parsed.term),C.parse('λk.k 3')));
});
test('numeric compilation normalizes zero and positive custom literals before any surrounding computation',async()=>{
  const entries=box();
  for(const number of ['0','3']){
    const compiled=await E.compile(number,entries,'custom:Box');assert.equal(C.findRedex(compiled.term),null);
    assert.ok(C.equal(compiled.term,C.parse(`λk.k ${number}`)));assert.equal(compiled.mappings[0].number,number);
  }
  const expression=await E.compile('(λx.x) 2_Box',entries);assert.equal(expression.term.type,'app');assert.equal(C.findRedex(expression.term.arg),null);
  assert.ok(C.findRedex(expression.term));assert.ok(C.equal(C.step(expression.term).term,C.parse('λk.k 2')));
  const inner=await E.compile('λk.(λz.z) 2_Box',entries);assert.ok(C.findRedex(inner.term));assert.ok(C.equal(C.step(inner.term).term,C.parse('λa.λb.b 2')));
});
test('compiled literal cache follows the converter definition and includes repeated inputs',async()=>{
  const entries=box(),first=await E.compile('2_Box',entries),second=await E.compile('2_Box',entries);
  assert.ok(first.mappings[0].steps>0);assert.equal(second.mappings[0].steps,0);assert.equal(first.term,second.term);
  const changed=E.define(entries,'Box','λn.λk.k n n',undefined,'Box'),next=await E.compile('2_Box',changed);
  assert.ok(next.mappings[0].steps>0);assert.ok(C.equal(next.term,C.parse('λk.k 2 2')));
});
test('endless numeral conversions yield and can be canceled without a fixed step cutoff',async()=>{
  const cycle=E.define([],'Loop','λn.(λx.x x) (λx.x x)');
  await assert.rejects(E.compile('0_Loop',cycle),/重复归约循环/);
  const entries=E.define([],'Loop','λn f.(λx.f ((λt.t) (x x))) (λx.f ((λt.t) (x x)))'),controller=new AbortController();
  let progressed=false;const pending=E.compile('0_Loop',entries,'church',{signal:controller.signal,onProgress:()=>{progressed=true;controller.abort();}});
  await assert.rejects(pending,error=>error.name==='AbortError');assert.ok(progressed);
});
test('function saving accepts automatically compiled literals without changing source or provenance',async()=>{
  const entries=box(),compiled=await E.compile('0_Box',entries),functions=L.add([],'ZERO','0_Box',Infinity,'church',6,entries,compiled);
  assert.equal(C.findRedex(functions[0].term),null);assert.equal(functions[0].source,'0_Box');assert.deepEqual(functions[0].encodings,['Box']);
});
test('unmarked numbers use the selected encoding and explicit suffixes override every default',()=>{
  const entries=box();
  for(const selected of ['church','decimal','custom:Box']){
    assert.ok(C.equal(E.parse('3_church',entries,Infinity,selected).term,C.parse('3')));
    assert.ok(C.equal(E.parse('3_丘奇数',entries,Infinity,selected).term,C.parse('3')));
    assert.equal(D.format(D.read(E.parse('-0.5_decimal',entries,Infinity,selected).term)),'-0.5');
    assert.ok(C.equal(normalize(E.parse('3_Box',entries,Infinity,selected).term),C.parse('λk.k 3')));
  }
  const decimal=E.parse('-0.5',entries,Infinity,'decimal');assert.equal(D.format(D.read(decimal.term)),'-0.5');assert.deepEqual(decimal.encodings,['decimal']);
  const custom=E.parse('3',entries,Infinity,'custom:Box');assert.ok(C.equal(normalize(custom.term),C.parse('λk.k 3')));assert.deepEqual(custom.encodings,['Box']);
  assert.throws(()=>E.parse('0.5',entries,Infinity,'custom:Box'),/非负整数/);
});
test('function definitions use the current encoding and converter definitions still receive Church numerals',()=>{
  const entries=box(),fn=L.add([],'THREE','3',Infinity,'custom:Box',6,entries).at(-1);
  assert.ok(C.equal(normalize(fn.term),C.parse('λk.k 3')));assert.deepEqual(fn.encodings,['Box']);
  assert.equal(D.format(D.read(L.add([],'HALF','0.5',Infinity,'decimal',6,entries).at(-1).term)),'0.5');
  const converter=E.define([],'Constant','λn.3_丘奇数');assert.ok(C.equal(normalize(E.parse('9_Constant',converter).term),C.parse('3')));
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
  for(const name of ['decimal','church','丘奇数','列表小数','bad name','bad.name',''])assert.throws(()=>E.define([],name,'λn.n'));
  assert.throws(()=>E.define([],'Open','λn.m'),/自由变量/);
  assert.throws(()=>E.define(box(),'Box','λn.n'),/已存在/);
});

test('custom suffixes accept numeric, underscore, Unicode and symbol names',async()=>{
  for(const name of ['2Bad','_我的编码','+','🙂','123','bad-name']){
    const entries=E.define([],name,'λn.λk.k n');
    assert.ok(E.isLiteral('3_'+name,entries));
    const compiled=await E.compile('3_'+name,entries);
    assert.ok(C.equal(compiled.term,C.parse('λk.k 3')));
    assert.deepEqual(compiled.encodings,[name]);
  }
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
  for(const example of P.examples.filter(e=>e.decimalOperation&&e.category!=='高等小数')){
    const parsed=E.parse(P.inputSourceFor(example));assert.deepEqual(parsed.encodings,['decimal']);
    assert.equal(D.format(D.read(normalize(parsed.term))),example.expected);
  }
});
test('Church list and Boolean literals support selection, suffixes and templates',()=>{
  for(const [source,encoding,label] of [
    ['120','list','丘奇列表 [1, 2, 0]'],
    ['0_丘奇列表','church','丘奇列表 [0]'],
    ['1_bool','church','丘奇布尔 TRUE（1）'],
    ['0','bool','丘奇布尔 FALSE（0）'],
    ['B1','list','丘奇布尔 TRUE（1）']
  ]){
    const parsed=E.parse(source,[],Infinity,encoding,{bool:'B{n}'});
    assert.equal(E.readBuiltin(parsed.term,parsed.encodings[0]),label);
  }
  assert.throws(()=>E.parse('2_bool'),/0（假）或 1（真）/);
  for(const encoding of ['list','bool']){
    const raw=sample();raw.view.numberEncoding=encoding;raw.view.numberFormats={[encoding]:'N{n}'};
    assert.equal(S.decode(S.encode(raw)).view.numberEncoding,encoding);
  }
  const raw=sample();
  raw.dataEncodings=[{...raw.dataEncodings[0],name:'list'}];
  raw.view.numberEncoding='custom:list';
  raw.encodingDraft.editing='list';
  const saved=S.decode(S.encode(raw));
  assert.equal(E.parse('3_list',saved.dataEncodings).literals[0].name,'list');
  assert.equal(E.readBuiltin(E.parse('3',saved.dataEncodings,Infinity,'list').term,'list'),'丘奇列表 [3]');
});
test('bracket lists parse complete items and preserve lexical scope',()=>{
  assert.equal(E.readChurchList(E.parse('[12, [2, 3], v]',[],Infinity,'list').term),'丘奇列表 [12, [2, 3], v]');
  assert.equal(E.readBuiltin(E.parse('[]').term,'list'),'丘奇列表 []');
  const term=C.normalize(E.parse('(λc.[c, n]) z').term,50).term;
  assert.equal(E.readChurchList(term),'丘奇列表 [z, n]');
  assert.equal(E.readChurchList(C.parse('λc n.c c n')),null);
  const wrapped=E.parse('[3]',[],Infinity,'church',{church:'[{n}]'});
  assert.equal(C.churchNumber(wrapped.term),3);
  assert.throws(()=>E.parse('[1, 2'),/末尾需要/);
});
test('signed integers support default and explicit encodings, and restore from a save',()=>{
  for(const [source,encoding,value] of [
    ['-12','int','-12'],['-3_int','church','-3'],['-0_丘奇整数','decimal','0'],['4','int','4']
  ]){
    const parsed=E.parse(source,[],Infinity,encoding);
    assert.deepEqual(parsed.encodings,['int']);
    assert.equal(E.readBuiltin(parsed.term,'int'),`丘奇整数 ${value}`);
  }
  assert.throws(()=>E.parse('-1.25_int'),/只接受整数/);
  const raw=sample();
  raw.view.numberEncoding='int';raw.view.numberFormats={int:'I{n}'};
  const saved=S.decode(S.encode(raw));
  assert.equal(saved.view.numberEncoding,'int');
  assert.equal(E.readBuiltin(E.parse('I-3',[],Infinity,'int',saved.view.numberFormats).term,'int'),'丘奇整数 -3');
});
test('mapping tables match alpha-equivalent normal forms and replace one numeral immutably',()=>{
  const entries=E.putMapping(box(),'Box','003',C.parse('λk.k 3'));
  assert.deepEqual(E.lookup(C.parse('λrenamed.renamed 3'),entries,['Box']),[{name:'Box',number:'3'}]);
  assert.deepEqual(E.lookup(C.parse('λk.k 2'),entries,['Box']),[]);
  assert.deepEqual(E.lookup(C.parse('λk.k 3'),entries,['Other']),[]);
  const updated=E.putMapping(entries,'Box','3',C.parse('λk.k 2'));
  assert.equal(updated[0].table.length,1);assert.ok(C.equal(entries[0].table[0].term,C.parse('λk.k 3')));
  assert.equal(E.removeMapping(updated,'Box','3')[0].table.length,0);
  assert.throws(()=>E.putMapping(entries,'Box','-1',C.parse('0')),/非负整数/);
  assert.throws(()=>E.putMapping(entries,'Box','2',C.parse('(λx.x) 2')),/正规形/);
  assert.throws(()=>E.putMapping(entries,'Box','2',C.parse('free')),/闭合/);
});
test('mapping ambiguity is retained and changing a converter invalidates its old table',()=>{
  let entries=E.putMapping(box(),'Box','0',C.parse('λk.k 0'));entries=E.putMapping(entries,'Box','1',C.parse('λk.k 0'));
  assert.equal(E.lookup(C.parse('λx.x 0'),entries,['Box']).length,2);
  const renamed=E.define(entries,'NewBox',entries[0].source,undefined,'Box');assert.equal(renamed[0].table.length,2);
  const changed=E.define(entries,'Box','λn.n',undefined,'Box');assert.equal(changed[0].table.length,0);
});
test('mapping tables survive archives and malformed or reducible records are rejected',()=>{
  const raw=sample();raw.dataEncodings=E.putMapping(raw.dataEncodings,'Box','3',C.parse('λk.k 3'));
  const restored=S.decode(S.encodeBackup(raw,S.encode(raw)));
  assert.deepEqual(restored.dataEncodings,raw.dataEncodings);assert.deepEqual(S.decode(restored.checkpointText).dataEncodings,raw.dataEncodings);
  for(const table of [[{number:'3',term:C.V('free')}],[{number:'3',term:C.parse('(λx.x) 3')}],[{number:'3',term:C.parse('3')},{number:'3',term:C.parse('3')}],{}]){
    raw.dataEncodings[0].table=table;assert.throws(()=>S.decode(JSON.stringify(raw)));
  }
});
