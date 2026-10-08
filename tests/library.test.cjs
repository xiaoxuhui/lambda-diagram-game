const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),L=require('../src/library.js');
const p=C.parse;
test('named identity expands and runs',()=>{const f=L.add([],'ID','λx.x');assert.ok(C.equal(C.step(L.expand(p('ID (λy.y)'),f)).term,p('λy.y')));});
test('bound names take precedence over library names',()=>{const f=L.add([],'ID','λx.x');assert.deepEqual(L.expand(p('λID.ID'),f),p('λID.ID'));});
test('expansion is hygienic for free variables',()=>{const f=L.add([],'F','λx.y');assert.ok(C.equal(L.expand(p('λy.F'),f),p('λz.λx.y')));});
test('simultaneous expansion does not expand free names inside definitions',()=>{
  let f=L.add([],'F','λx.G');f=L.add(f,'G','λy.y');const t=L.expand(p('F G'),f);
  assert.ok(C.equal(t,p('(λx.G)(λy.y)')));assert.deepEqual([...C.freeVars(t)],['G']);
});
test('definitions can call existing definitions',()=>{let f=L.add([],'ID','λx.x');f=L.add(f,'TWICE','λf x.f (f x)');f=L.add(f,'DOUBLEID','TWICE ID');assert.ok(C.equal(C.normalize(L.expand(p('DOUBLEID'),f)).term,p('λx.x')));});
test('deleting dependency preserves compiled definition',()=>{
  let f=L.add([],'ID','λx.x');f=L.add(f,'COPY','ID');const before=L.expand(p('COPY'),f);f=L.remove(f,'ID');
  assert.deepEqual(L.expand(p('COPY'),f),before);assert.equal(L.expand(p('ID'),f).type,'var');
});
test('deletion is immutable and unknown deletion is harmless',()=>{const f=L.add([],'F','λx.x');assert.equal(L.remove(f,'F').length,0);assert.equal(f.length,1);assert.deepEqual(L.remove(f,'Z'),f);});
test('duplicate names cannot silently replace a function',()=>{const f=L.add([],'F','λx.x');assert.throws(()=>L.add(f,'F','λx y.x'),/已存在/);assert.equal(f.length,1);});
test('invalid names and overlong names are rejected',()=>{for(const n of ['','1f','a b','__proto__','x'.repeat(33)])assert.throws(()=>L.add([],n,'λx.x'),/函数名/);});
test('names colliding with object prototypes are safe',()=>{const f=L.add([],'constructor','λx.x');assert.ok(C.equal(L.expand(p('constructor'),f),p('λx.x')));});
test('invalid definitions leave library unchanged',()=>{const f=[];assert.throws(()=>L.add(f,'F','λx.'),/表达式/);assert.deepEqual(f,[]);});
test('direct self-reference is rejected but bound same name is valid',()=>{assert.throws(()=>L.add([],'F','λx.F x'),/自身/);assert.equal(L.add([],'F','λF.F').length,1);});
test('more than 32 functions can be added, called and deleted',()=>{let f=[];for(let i=0;i<100;i++)f=L.add(f,`F${i}`,'λx.x');assert.equal(f.length,100);assert.ok(C.equal(C.normalize(L.expand(p('F99 (λy.y)'),f)).term,p('λy.y')));f=L.remove(f,'F99');assert.equal(f.length,99);assert.equal(L.expand(p('F98'),f).type,'abs');});
test('placeholders cannot collide with source names',()=>{const f=L.add([],'F','λx.lambdaMacro1');assert.ok(C.equal(L.expand(p('λlambdaMacro2.F lambdaMacro1'),f),p('λz.(λx.lambdaMacro1) lambdaMacro1')));});
test('expanded expression retains all nodes beyond the old quota',()=>{let t=C.V('x');for(let i=0;i<11;i++)t=C.A(t,t);assert.equal(C.inspect(L.expand(p('F F'),[{name:'F',term:t}])).nodes,8191);});
