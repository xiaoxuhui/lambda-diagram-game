const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),L=require('../src/library.js'),G=require('../src/guide.js'),P=require('../src/presets.js');

test('tutorial import includes only the selected function and its dependencies, even in reverse order',()=>{
  const definitions=[{name:'twice',source:'λx.id (id x)'},{name:'id',source:'λx.x'},{name:'unused',source:'λx.λy.x'}];
  const result=L.importDefinitions([],definitions,['twice']);
  assert.deepEqual(result.added,['twice']);assert.equal(result.functions.length,1);assert.match(result.functions[0].source,/λid\./);
  assert.ok(C.equal(C.normalize(result.functions[0].term,100).term,C.parse('λx.x')));
  assert.equal(L.importDefinitions(result.functions,definitions,['twice']).added.length,0);
});

test('name collisions are skipped and dependencies stay private without numbered functions',()=>{
  const original=L.add([],'id','λx.z'),definitions=[{name:'id',source:'λx.x'},{name:'copy',source:'λid2.id id2'}];
  const result=L.importDefinitions(original,definitions,['copy']);
  assert.equal(result.functions[0],original[0]);assert.deepEqual(result.added,['copy']);
  assert.deepEqual(result.skipped,[]);assert.deepEqual(result.renamed,[]);
  assert.equal(result.functions.length,2);
  assert.ok(!result.functions.some(fn=>fn.name==='id2'));assert.match(L.importFeedback(result),/辅助定义已封装/);
  const copy=result.functions.find(fn=>fn.name==='copy');
  assert.ok(C.equal(L.expand(copy.body,result.functions),copy.term));assert.equal(C.freeVars(copy.term).size,0);
  assert.equal(C.normalize(C.A(copy.term,C.parse('4')),100).status,'normal');
  assert.equal(C.churchNumber(C.normalize(C.A(copy.term,C.parse('4')),100).term),4);
  const repeated=L.importDefinitions(result.functions,definitions,['copy']);
  assert.equal(repeated.added.length,0);assert.deepEqual(repeated.ready,['copy']);
});

test('an existing entry is skipped before unused dependencies are imported, for equal and different definitions',()=>{
  for(const source of ['λx.x','λx.z']){
    const functions=L.add([],'entry',source),result=L.importDefinitions(functions,[{name:'id',source:'λx.x'},{name:'entry',source:'λx.id x'}],['entry']);
    assert.deepEqual(result.added,[]);assert.deepEqual(result.skipped,['entry']);assert.deepEqual(result.functions,functions);
  }
});

test('same name with the same definition is ready and generation continues without a duplicate warning',()=>{
  const functions=L.add([],'id','λoriginal.original'),definitions=[{name:'id',source:'λx.x'},{name:'next',source:'λarg.id arg'}];
  const result=L.importDefinitions(functions,definitions,['id','next']);
  assert.deepEqual(result.ready,['id']);assert.deepEqual(result.skipped,[]);assert.deepEqual(result.added,['next']);
  assert.equal(result.functions[0],functions[0]);assert.equal(result.functions.length,2);
  assert.match(L.importFeedback(result),/已有相同定义，已准备好：id/);assert.ok(!L.importFeedback(result).includes('重名'));
  const repeated=L.importDefinitions(result.functions,definitions,['next']);
  assert.deepEqual(repeated.ready,['next']);assert.deepEqual(repeated.skipped,[]);assert.deepEqual(repeated.added,[]);
  const r=C.normalize(L.expand(C.parse('next 4'),repeated.functions),1000);assert.equal(r.status,'normal');assert.equal(C.churchNumber(r.term),4);
});

test('unrelated library names cannot change a tutorial free variable, and failed imports are atomic',()=>{
  const original=L.add([],'free','λx.x');
  const result=L.importDefinitions(original,[{name:'open',source:'λx.free'}]);
  assert.deepEqual([...C.freeVars(result.functions[1].term)],['free']);
  for(const definitions of [[{name:'a',source:'b'},{name:'b',source:'a'}],[{name:'ok',source:'λx.x'},{name:'bad',source:'λx.'}]])assert.throws(()=>L.importDefinitions(original,definitions));
  assert.equal(original.length,1);
});

test('all tutorial programs and dependencies can be imported, and factorial remains runnable',()=>{
  for(const example of P.examples){
    const doc=G.lesson(example),selected=G.libraryNames(doc);
    if(!['Church 数字 2','防止变量捕获'].includes(example.name))assert.ok(selected.length,example.name+' must expose its named main function');
    const result=L.importDefinitions([],doc.symbols,selected),names=new Set(result.functions.map(fn=>fn.name));
    for(const fn of result.functions){assert.ok(C.equal(L.expand(fn.body,result.functions),fn.term),`${example.name}: ${fn.name}`);assert.ok([...C.freeVars(fn.term)].every(name=>!names.has(name)));}
    if(example.name.startsWith('阶乘 · 迭代')){
      const fac=result.functions.find(fn=>fn.name==='fac'),value=C.normalize(C.A(fac.term,C.parse('3')),10000);
      assert.equal(value.status,'normal');assert.equal(C.churchNumber(value.term),6);
    }
  }
});
