const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),G=require('../src/guide.js'),L=require('../src/library.js'),E=require('../src/data-encoding.js'),D=require('../src/decimal.js'),Lazy=require('../src/lazy-eval.js');
const example=P.examples.find(e=>e.name.startsWith('乘方 ·')),doc=G.lesson(example),name=G.libraryNames(doc)[0],functions=L.importDefinitions([],doc.symbols,[name]).functions;
test('Church powers return canonical numerals for zero base and zero exponent in every order',()=>{
  for(const a of [0,1,2,3])for(const b of [0,1,2,3])for(const strategy of C.STRATEGIES)for(const direction of C.DIRECTIONS){
    const term=L.expand(C.parse(`${name} ${a} ${b}`),functions),r=C.normalize(term,30000,strategy,direction);
    assert.equal(r.status,'normal');assert.equal(C.churchNumber(r.term),a**b,`${a}^${b}: ${strategy}/${direction}`);assert.ok(C.equal(r.term,C.parse(String(a**b))));
  }
});
test('plain and lazy unfolding of power both retain zero boundary results',async()=>{
  const F=require('../src/function-reduction.js');
  for(const [a,b,want] of [[0,0,1],[0,4,0],[4,0,1]]){
    const source=example.term.replace(/2 4$/,`${a} ${b}`),plain=P.preparePlain(C.parse(source));assert.equal(C.churchNumber(C.normalize(plain,30000).term),want);
    const term=C.parse(`${name} ${a} ${b}`),prepared=F.prepare(term,functions,[]),result=await Lazy.normalize(prepared.term,{functions:prepared.definitions});assert.equal(C.churchNumber(result),want);
  }
});
test('decimal powers already handle zero correctly, including the documented 0^0 convention',async()=>{
  for(const [a,b,want] of [['0','4','0'],['2.5','0','1'],['-2','0','1'],['0','0','1']]){
    const term=E.parse(D.expression('POW',[a+'_decimal',b+'_church'])).term,value=await Lazy.normalize(term,{signal:AbortSignal.timeout(10000)});
    assert.equal(D.format(D.read(value)),want);
  }
  assert.match(doc.principle.join('\n'),/0⁰.*1/);
});
