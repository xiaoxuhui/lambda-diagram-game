const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),E=require('../src/data-encoding.js'),G=require('../src/guide.js'),L=require('../src/library.js');
function project(source,definitions){
  const names=new Set(definitions.map(d=>d.name));
  function walk(t){
    if(t.type==='var')return t;
    if(t.type==='abs')return C.L(t.param,walk(t.body));
    const fn=walk(t.fn),arg=walk(t.arg);
    return fn.type==='abs'&&names.has(fn.param)?C.substitute(fn.body,fn.param,arg):C.A(fn,arg);
  }
  return walk(E.parse(source).term);
}
test('all examples use linked helpers without changing binding, data encoding, or composition',()=>{
  let linked=0;
  for(const example of P.examples){
    const plan=P.programFor(example),raw=P.rawInputSourceFor(example);
    assert.equal(plan.source,P.inputSourceFor(example));
    assert.ok(C.equal(project(plan.source,plan.definitions),E.parse(raw).term),example.name);
    if(example.decimalOperation)assert.ok(C.equal(project('3_church '+plan.source,plan.definitions),E.parse('3_church '+raw).term),example.name+' composition');
    const declared=new Set(G.lesson(example).symbols.map(symbol=>symbol.name));
    let existingBinding=false;const pending=[E.parse(plan.source).term];
    while(pending.length){const node=pending.pop();if(node.type==='abs')pending.push(node.body);else if(node.type==='app'){
      if(node.fn.type==='abs'&&declared.has(node.fn.param)&&C.freeVars(node.fn.body).has(node.fn.param))existingBinding=true;
      pending.push(node.fn,node.arg);
    }}
    if(plan.definitions.length||existingBinding)linked++;
    const functions=[];
    for(const d of plan.definitions)functions.push({name:d.name,term:L.expand(E.parse(d.source).term,functions)});
    assert.ok(C.equal(L.expand(E.parse(plan.call).term,functions),E.parse(raw).term),example.name+' helper calls');
  }
  assert.ok(linked>=80,'function-based samples must link actual helper calls');
});
test('existing local helper definitions are not extracted again as numbered forwarding parameters',()=>{
  const division=P.examples.find(e=>e.name.startsWith('序对除法')),plan=P.programFor(division);
  assert.deepEqual(plan.definitions,[],'the division already contains its complete helper bindings');
  for(const name of ['true','false','pair','succ','pred','quotstep','pairdiv']){
    assert.equal([...plan.source.matchAll(new RegExp('λ'+name+'\\.','g'))].length,1,name+' defined once');
    assert.ok(!new RegExp('\\b'+name+'[2-9]\\b').test(plan.source));
  }
  const integer=P.programFor(P.examples.find(e=>e.name.startsWith('整数除法')));
  assert.ok(integer.definitions.some(d=>d.name==='y'));assert.ok(!integer.definitions.some(d=>d.name==='y2'));
});
test('every importable main function includes all dependencies and has no escaped parameters',()=>{
  for(const example of P.examples){
    const doc=G.lesson(example),names=G.libraryNames(doc),result=L.importDefinitions([],doc.symbols,names);
    for(const name of names){const fn=result.functions.find(f=>f.name===name);assert.ok(fn,example.name);assert.deepEqual([...C.freeVars(fn.term)],[],example.name+': '+name);}
  }
});
test('pair division calls its actual transition and constructor and supports both pair projections',()=>{
  const definitions=P.pairDivision.definitions,byName=new Map(definitions.map(d=>[d.name,C.parse(d.source)]));
  assert.deepEqual([...C.freeVars(byName.get('pairdiv'))].sort(),['ISZERO','divresult','divstate','divzero']);
  assert.ok(C.freeVars(byName.get('divstate')).has('quotstep'));assert.ok(C.freeVars(byName.get('divstate')).has('PAIR'));
  for(const name of ['PAIR','SUB','SUCC','ATMOST'])assert.ok(C.freeVars(byName.get('quotstep')).has(name));
  const functions=L.importDefinitions([],definitions).functions;
  for(const [m,n,r,q] of [[0,2,0,0],[1,2,1,0],[7,2,1,3],[8,4,0,2],[9,4,1,2]])for(const [selector,expected] of [['FIRST',r],['SECOND',q]]){
    const value=C.normalize(L.expand(C.parse(`${selector} (divstate ${m} ${n})`),functions),30000);
    assert.equal(value.status,'normal');assert.equal(C.churchNumber(value.term),expected);
  }
});
