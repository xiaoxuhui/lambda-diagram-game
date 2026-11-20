const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),D=require('../src/decimal.js'),E=require('../src/data-encoding.js'),M=require('../src/polynomial.js'),Lazy=require('../src/lazy-eval.js');
const fields=term=>{assert.equal(term.type,'abs');let node=term.body;const values=[];while(node.type==='app'){values.unshift(node.arg);node=node.fn;}assert.equal(node.name,term.param);return values;};
const run=term=>Lazy.normalize(term,{signal:AbortSignal.timeout(30000),onPause:()=>true});

test('public decimal digits follow written order and include the integer zero',async()=>{
  const expected=C.parse('λk.k (λa b.a) [0,1,2,5] 3');assert.ok(C.equal(D.encodeLiteral('0.125'),expected));
  for(const [text,digits,places]of [['0.125','[0, 1, 2, 5]',3],['-0.001','[0, 0, 0, 1]',3],['1.25','[1, 2, 5]',2],['0','[0]',0]]){
    const record=fields(D.encodeLiteral(text));assert.equal(E.readChurchList(record[1]),'丘奇列表 '+digits);assert.equal(C.churchNumber(record[2]),places);assert.equal(D.format(D.read(D.encodeLiteral(text))),text);
  }
  const result=await run(C.A(C.A(D.program('DIV',3),D.encodeLiteral('1')),D.encodeLiteral('8')));
  assert.ok(C.equal(result,expected));
  const tiny=await run(C.A(C.A(D.program('MUL'),D.encodeLiteral('0.02')),D.encodeLiteral('0.03')));
  assert.equal(E.readChurchList(fields(tiny)[1]),'丘奇列表 [0, 0, 0, 0, 6]');assert.equal(D.format(D.read(tiny)),'0.0006');
});

test('old saved decimal records retain their original AST and number with explicit layout metadata',()=>{
  const S=require('../src/snapshot.js'),old=C.parse('λk.k (λa b.a) [5,2,1] 3');
  assert.equal(D.format(D.read(old,{digitsOrder:'reverse'})),'0.125');
  const raw={version:2,draft:'old expression',functions:[],completed:[],mode:'free',level:0,session:{original:old,steps:0,dirty:false,halt:'',encodings:['decimal']},view:{numberEncoding:'decimal',speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''};
  const restored=S.decode(JSON.stringify(raw));assert.equal(restored.view.decimalDigitsOrder,'reverse');assert.ok(C.equal(restored.term,old));
  assert.equal(D.format(D.read(restored.term,{digitsOrder:restored.view.decimalDigitsOrder})),'0.125');
  raw.view.decimalDigitsOrder='forward';raw.session.original=D.encodeLiteral('0.125');
  assert.equal(S.decode(S.encode(raw)).view.decimalDigitsOrder,'forward');
});

test('rational, signed integer and signed decimal records have exactly the requested fields',()=>{
  assert.deepEqual(M.readRational(C.parse('λk.k 2 3')),[2,3]);
  for(const [text,positive,magnitude] of [['12',true,12],['-12',false,12],['-0',true,0]]){
    const term=E.parse(text,[],Infinity,'int').term,record=fields(term);
    assert.equal(record.length,2);assert.ok(C.equal(record[0],C.parse(positive?'λa b.a':'λa b.b')));assert.equal(C.churchNumber(record[1]),magnitude);
    assert.equal(E.readBuiltin(term,'int'),`丘奇整数 ${text==='-0'?'0':text}`);
  }
  const term=D.encodeLiteral('-12.375'),record=fields(term);
  assert.equal(record.length,3);assert.ok(C.equal(record[0],C.parse('λa b.b')));
  assert.equal(E.readChurchList(record[1]),'丘奇列表 [1, 2, 3, 7, 5]');assert.equal(C.churchNumber(record[2]),3);
  assert.equal(D.format(D.read(term)),'-12.375');assert.equal(D.read(term,{legacyOnly:true}),null);
});

test('arithmetic accepts old and new decimal input, but outputs only three fields',async()=>{
  for(const encode of [D.encodeLiteral,D.encodeInternal]){
    const result=await run(C.A(C.A(D.program('ADD'),encode('-0.2')),encode('0.5')));
    assert.equal(fields(result).length,3);assert.equal(D.format(D.read(result)),'0.3');
  }
  const oldInt=C.parse('λk.k (λa b c d.d) (λa b.a) 3');assert.equal(E.readBuiltin(oldInt,'int'),'丘奇整数 -3');
  const old=D.encodeInternal('-1.25');assert.equal(D.format(D.read(old)),'-1.25');
});

test('inexactness is internal and is removed from the final decimal record',async()=>{
  const internal=await run(C.A(C.A(D.internalProgram('DIV',2),D.encodeInternal('1')),D.encodeInternal('3')));
  assert.equal(fields(internal).length,5);assert.equal(D.read(internal).approximate,true);
  const result=await run(E.parse(D.expression('DIV',['1_decimal','3_decimal'],2)).term);
  assert.equal(fields(result).length,3);assert.equal(D.format(D.read(result)),'0.33');
});

test('explicit output-place arguments change actual Lambda calculation precision',async()=>{
  for(const [op,x,places,expected] of [['SQRT','2',2,'1.41'],['SQRT','2',6,'1.414213'],['SIN','0.5',2,'0.47'],['SIN','0.5',6,'0.479425'],['COS','0.5',3,'0.877'],['SINH','-0.5',3,'-0.521']]){
    const source=D.expression(op,[x+'_decimal'],places);assert.ok(source.includes(`(${places}_church)`));
    const result=await run(E.parse(source).term);assert.equal(D.format(D.read(result)),expected,op+' '+places);assert.equal(fields(result).length,3);
  }
  assert.ok(!D.expression('ADD',['1_decimal','2_decimal']).includes('_church'));
});
