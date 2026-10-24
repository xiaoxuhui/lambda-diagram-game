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
 const term=D.expand(C.parseInput('ADD 0.1 0.2'));assert.equal(C.freeVars(term).size,0);
});
