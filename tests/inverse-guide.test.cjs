const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/presets.js'),G=require('../src/guide.js'),L=require('../src/library.js'),C=require('../src/core.js'),D=require('../src/decimal.js');
const cases=[['整数除法','QUOT','8 4',2,'MUL 2'],['开根号','ROOT','9 3',2,'λb.POWER b 2'],['对数','LOG','3 8',1,'POWER 2'],['超对数','SLOG','2 4',2,'TET 2'],['超根号','SROOT','3 2',1,'λb.TET b 2'],['超超根号','PROOT','2 1',2,'λb.PENT b 2'],['超超对数','PLOG','2 2',1,'PENT 2']];
const normal=term=>{const r=C.normalize(term,30000);assert.equal(r.status,'normal');return r.term;};
for(const [prefix,key,args,expected,op] of cases)test(prefix+' imports a reusable function and explains the actual search states',()=>{
  const example=P.examples.find(e=>!e.decimalOperation&&e.name.startsWith(prefix+' ·')),doc=G.lesson(example);
  const selected=G.libraryNames(doc),symbol=doc.symbols.find(s=>s.uses.includes(key));
  assert.deepEqual(selected,[symbol.name]);
  const imported=L.importDefinitions([],doc.symbols,selected),main=imported.functions.find(fn=>fn.name===symbol.name);
  assert.equal(C.freeVars(main.term).size,0);
  assert.equal(C.churchNumber(normal(L.expand(C.parse(main.name+' '+args),imported.functions))),expected);
  const [,a,b]=example.term.match(/(\d+) (\d+)$/);
  assert.equal(C.churchNumber(normal(C.A(C.A(main.term,C.parse(a)),C.parse(b)))) ,Number(example.expected));
  assert.equal(L.importDefinitions(imported.functions,doc.symbols,selected).added.length,0);
  assert.equal(doc.inputs.length,2);assert.ok(doc.inputs.every(i=>i.value.endsWith('_church')));
  assert.ok(doc.flow);assert.match(doc.parameterNote,/加入函数库/);assert.match(doc.steps[3][1],/正规序/);
  assert.ok(!doc.steps[1][2].includes('…'),'complete search definition');
  assert.ok(!doc.steps[2][2].includes('…'),'complete comparator definition');
  const raw=G.rawLesson(example),operation=L.importDefinitions([],raw.symbols).functions,table=doc.steps[4][3];
  let previous=0;
  for(const [i,row] of table.rows.entries()){
    const [candidate,old,value,target]=row.map(Number);
    assert.equal(old,previous);
    assert.equal(C.churchNumber(normal(L.expand(C.parse('('+op+') '+candidate),operation))),value);
    if(value<target){assert.ok(i<table.rows.length-1);previous=candidate;}
    else {assert.equal(i,table.rows.length-1);assert.equal(Number(example.expected),value===target?candidate:old);}
  }
  assert.equal(doc.flow.rows.at(-1)[1],example.expected);
});
test('division import protects conflicting definitions and keeps zero division out of the search',()=>{
  const doc=G.lesson(P.examples.find(e=>e.name.startsWith('整数除法'))),mainName=G.libraryNames(doc)[0];
  const original=L.add([],mainName,'λx.x'),result=L.importDefinitions(original,doc.symbols,[mainName]);
  assert.equal(result.functions[0],original[0]);assert.deepEqual(result.skipped,[mainName]);assert.deepEqual(result.added,[]);
  const clean=L.importDefinitions([],doc.symbols,[mainName]);
  const main=clean.functions.find(fn=>fn.name===mainName);
  assert.equal(D.read(normal(C.A(C.A(main.term,C.parse('7')),C.parse('0')))).error,'除数不能为0');
});
