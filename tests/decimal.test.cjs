const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../src/core.js'),D=require('../src/decimal.js');
function calculate(op,a,b,precision=6){let t=C.A(C.A(D.program(op,precision),D.encodeLiteral(a)),D.encodeLiteral(b));
 for(let n=0;n<250000;n++){const r=C.step(t);if(!r){const value=D.read(t);assert.ok(value);return D.format(value);}t=r.term;}assert.fail('test reduction budget exceeded');
}
test('signed digit lists preserve decimals without Number rounding',()=>{
 for(const [s,want] of [['-12.375','-12.375'],['0.0001','0.0001'],['001.2300','1.23'],['-0.00','0'],['9007199254740993123456789.123456789','9007199254740993123456789.123456789']])assert.equal(D.format(D.read(D.encodeLiteral(s))),want);
 assert.throws(()=>D.encodeLiteral('1e3'));assert.throws(()=>D.encodeLiteral('1.'));
});
test('digit addition and subtraction align places, carry, borrow and signs',()=>{
 for(const [op,a,b,want] of [['ADD','0.1','0.2','0.3'],['ADD','9.9','0.1','10'],['ADD','1.2','0.03','1.23'],['ADD','-2.5','1.25','-1.25'],['ADD','-1','1','0'],['SUB','1','2','-1'],['SUB','1.01','0.02','0.99'],['SUB','-1','-2','1']])assert.equal(calculate(op,a,b),want,`${a} ${op} ${b}`);
});
test('digit multiplication keeps the decimal position and sign',()=>{
 for(const [a,b,want] of [['0.2','0.3','0.06'],['-1.2','0.5','-0.6'],['-2','-3','6'],['0','123.45','0'],['1.5','1.5','2.25']])assert.equal(calculate('MUL',a,b),want,`${a}*${b}`);
});
test('long division reports exactness, truncation, signs and division by zero',()=>{
 for(const [a,b,p,want] of [['1','8',3,'0.125'],['1','3',3,'≈ 0.333'],['-1','8',3,'-0.125'],['1.2','0.3',2,'4'],['0','7',2,'0'],['1','0',2,'除数不能为0'],['2','3',0,'≈ 0']])assert.equal(calculate('DIV',a,b,p),want,`${a}/${b}`);
 assert.throws(()=>D.program('DIV',-1));
});
test('default editor parser uses decimal lists while the explicit Church parser stays compatible',()=>{
 assert.equal(typeof C.parseInput,'function');assert.equal(D.format(D.read(C.parseInput('-0.25'))),'-0.25');
 assert.equal(D.format(D.read(C.parseInput('3'))),'3');assert.equal(C.churchNumber(C.parse('3')),3);
 const term=C.parseInput(D.expression('ADD',['0.1','0.2']));assert.equal(C.freeVars(term).size,0);
});

test('all former decimal builtin names are ordinary free variables or custom functions',()=>{
 const L=require('../src/library.js');assert.equal(D.expand,undefined);
 for(const name of ['ADD','SUB','MUL','DIV','DEC_ADD','DEC_SUB','DEC_MUL','DEC_DIV','DECADD']){
  const raw=C.parseInput(`${name} 0.1 0.2`);assert.deepEqual([...C.freeVars(L.expand(raw,[]))],[name]);
  const f=L.add([],name,'λa b.a',Infinity,'decimal');let term=L.expand(raw,f);
  while(C.findRedex(term))term=C.step(term).term;assert.equal(D.format(D.read(term)),'0.1');
  const holder=L.add([],'HOLDER',`λx.${name} x`,Infinity,'decimal');assert.deepEqual([...C.freeVars(holder[0].term)],[name]);
 }
});
test('complete decimal program text parses, stays closed and actually computes all four operations',()=>{
 for(const [op,a,b,precision,want] of [['ADD','0.1','0.2',6,'0.3'],['SUB','1','2',6,'-1'],['MUL','0.2','0.3',6,'0.06'],['DIV','1','8',3,'0.125']]){
  const source=D.expression(op,[a,b],precision);assert.ok(source.length>1500);assert.ok(!/\bDEC_/.test(source));
  let term=C.parseInput(source);assert.equal(C.freeVars(term).size,0);
  for(let i=0;i<100000;i++){const next=C.step(term);if(!next)break;term=next.term;}
  assert.equal(C.findRedex(term),null);assert.equal(D.format(D.read(term)),want);
 }
});
test('long explicit definitions save and edit while legacy compiled alias sources retain meaning',()=>{
 const L=require('../src/library.js'),source=D.expression('ADD',['0.1','0.2'])+' '.repeat(12000);
 let f=L.add([],'DEC_ADD',source,undefined,'decimal');assert.equal(f[0].source,source);assert.equal(C.freeVars(f[0].term).size,0);
 f=L.update(f,'DEC_ADD','DECADD',source+' ','decimal');assert.equal(f[0].source,source+' ');
 const legacy={name:'OLD',source:'ADD 0.1 0.2',term:C.parseInput(D.expression('ADD',['0.1','0.2']))};
 assert.equal(L.update([legacy],'OLD','OLD',legacy.source,'decimal')[0].term,legacy.term);
});
test('decimal function definitions and unchanged old definitions keep their correct encoding',()=>{
 const L=require('../src/library.js');let functions=L.add([],'N','  -0.125\n',1500,'decimal');assert.equal(D.format(D.read(functions[0].term)),'-0.125');
 functions=L.update(functions,'N','NN','  -0.125\n','church');assert.equal(D.format(D.read(functions[0].term)),'-0.125');assert.equal(functions[0].source,'  -0.125\n');
 const old=L.add([],'TWO','2');assert.equal(C.churchNumber(L.update(old,'TWO','NEW','2','decimal')[0].term),2);
});
test('decimal preferences, AST and old-mode archives round trip without reinterpretation',()=>{
 const S=require('../src/snapshot.js'),original=D.encodeLiteral('-1.25');const raw={version:2,draft:'-1.25',functions:[],completed:[],mode:'free',level:0,session:{original,steps:0,dirty:false,halt:''},view:{numberEncoding:'decimal',decimalPlaces:4,speed:1,scale:1,autoFit:true,panX:0,panY:0,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''};
 const saved=S.decode(S.encode(raw));assert.equal(saved.view.numberEncoding,'decimal');assert.equal(saved.view.decimalPlaces,4);assert.equal(D.format(D.read(saved.term)),'-1.25');
 delete raw.view.numberEncoding;delete raw.view.decimalPlaces;raw.session.original=C.parse('2');const legacy=S.decode(JSON.stringify(raw));assert.equal(legacy.view.numberEncoding,'decimal');assert.equal(C.churchNumber(legacy.term),2);
 for(const mode of ['unknown',null]){raw.view.numberEncoding=mode;assert.throws(()=>S.decode(JSON.stringify(raw)));}
});
