const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),G=require('../src/guide.js');
test('every computational lesson shows a named Lambda definition, including Fibonacci and list folds',()=>{
  for(const example of P.examples){if(['防止变量捕获','Church 数字 2'].includes(example.name))continue;assert.match(G.lesson(example).core,/^[^\n=]+\s*=\s*[^\n]*λ/m,example.name);}
});
test('the named Fibonacci definition expands to the actual program and computes boundary inputs',()=>{
  const example=P.examples.find(item=>item.name.startsWith('斐波那契')),doc=G.lesson(example);
  assert.match(doc.core,/^fib = /);
  let term=C.V('fib');for(const symbol of [...doc.symbols].reverse())term=C.substitute(term,symbol.name,C.parse(symbol.source));
  assert.equal(C.freeVars(term).size,0);
  // The preset starts with an applied fixed-point combinator, so compare the
  // exact complete application after expanding the documented definition.
  assert.ok(C.equal(C.A(term,C.parse('5')),C.parse(P.rawSourceFor(example))));
  for(const [input,expected] of [[0,0],[1,1],[5,5]]){const result=C.normalize(C.A(term,C.parse(String(input))),20000);assert.equal(result.status,'normal');assert.equal(C.churchNumber(result.term),expected);}
});
