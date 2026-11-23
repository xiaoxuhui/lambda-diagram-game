const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/presets.js'),G=require('../src/guide.js'),L=require('../src/library.js'),C=require('../src/core.js'),D=require('../src/decimal.js'),Lazy=require('../src/lazy-eval.js');
for(const [operation,input,expected] of [['SQRT','4','2'],['SIN','0','0']])test('imported decimal '+operation+' receives precision through every helper',async()=>{
  const example=P.examples.find(e=>e.decimalOperation===operation),doc=G.lesson(example),names=G.libraryNames(doc);
  const imported=L.importDefinitions([],doc.symbols,names),main=imported.functions.find(f=>f.name===names[0]);
  assert.equal(C.freeVars(main.term).size,0);
  const term=C.A(C.A(main.term,C.parse('2')),D.encodeLiteral(input));
  const value=await Lazy.normalize(term,{signal:AbortSignal.timeout(15000),onPause:()=>true});
  assert.equal(D.format(D.read(value)),expected);
});
