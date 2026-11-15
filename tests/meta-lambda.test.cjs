const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/core.js');
const M=require('../src/meta-lambda.js');
const Library=require('../src/library.js');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');

test('the generated Lambda program normalizes code and preserves binding',()=>{
  const cases=[
    ['(λx.x) (λy.y)','λy.y'],
    ['(λx.λy.x) y','λz.y'],
    ['λz.(λx.λy.x) z','λz.λy.z'],
    ['λx.(λx.x) x','λx.x'],
    ['(λx.x x) (λu.u)','λu.u'],
    ['x0 ((λz.z) Hello_2)','x0 Hello_2'],
    ["(λu.λv.u) x0'", "λu.x0'"],
    ['(λa.b) ((λx.x x) (λx.x x))','b'],
    ['2 (λa.a) b','b']
  ];
  for(const [source,expected] of cases){
    const encoded=C.parse(M.compile(source));
    assert.equal(C.freeVars(encoded).size,0,source);
    assert.equal(M.read(encoded),null,source);
    const result=C.normalize(encoded,4000);
    assert.equal(result.status,'normal',source);
    const decoded=M.read(result.term);
    assert.ok(decoded&&C.equal(C.parse(decoded),C.parse(expected)),source);
  }
});

test('an ordinary Lambda result does not decode as interpreter output',()=>{
  for(const source of ['λx.x','λp.p (λx.x x x x x x x) (λa b c d.a 0)','λx.λy.x']){
    assert.equal(M.read(C.parse(source)),null,source);
  }
});

test('a trailing argument and a library function are interpreted inside a pasted program',()=>{
  const generated=M.compile('succ 2');
  const next='(λn f x.n f (f x)) 2';
  const pasted=`${generated} (${next})`;
  const functions=Library.add([],'succ','λn f x.n f (f x)');
  const expand=term=>Library.expand(term,functions);
  assert.ok(C.equal(C.parse(M.sourceOf(pasted)),C.parse(`succ 2 (${next})`)));
  for(const term of [
    M.repair(C.parse(pasted),expand),
    C.parse(M.compile(pasted,expand))
  ]){
    let value=term;
    for(let i=0;i<10000;i++){
      const step=C.step(value);
      if(!step)break;
      value=step.term;
    }
    assert.equal(C.findRedex(value),null);
    assert.equal(C.churchNumber(C.parse(M.read(value))),27);
  }
  assert.equal(M.sourceOf('succ 2'),'succ 2');
});

test('the pasted legacy example recovers successor in an empty library',()=>{
  const term=C.parse(readFileSync(join(__dirname,'fixtures/meta-lambda-legacy.txt'),'utf8'));
  assert.equal(M.needsRepair(term),true);
  let value=M.repair(term);
  assert.equal(M.needsRepair(value),false);
  for(let i=0;i<10000;i++){
    const step=C.step(value);
    if(!step)break;
    value=step.term;
  }
  assert.equal(C.findRedex(value),null);
  assert.equal(C.churchNumber(C.parse(M.read(value))),27);
});
