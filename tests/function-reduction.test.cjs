const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),L=require('../src/library.js'),F=require('../src/function-reduction.js'),T=require('../src/trace.js'),S=require('../src/snapshot.js'),Lazy=require('../src/lazy-eval.js');
const functions=[{name:'f',term:C.parse('λx.x')},{name:'g',term:C.parse('λx.x')}];
test('function unfolding follows both reduction orders and both traversal directions',()=>{
  const reducer=F.create(functions);
  for(const strategy of C.STRATEGIES)for(const direction of C.DIRECTIONS){
    let term=C.parse('(λz.z) (f (g a))');const first=reducer.find(term,strategy,direction);
    if(strategy==='normal'){assert.equal(first.kind,undefined);assert.deepEqual(first.path,[]);}
    else{assert.equal(first.kind,'unfold');assert.equal(first.term.name,direction==='left'?'f':'g');}
    let steps=0;while(reducer.find(term,strategy,direction)){assert.ok(steps++<30);term=reducer.step(term,strategy,direction).term;}
    assert.ok(C.equal(term,C.V('a')));
  }
});
test('a remaining function name prevents false normal form, including after a beta step',()=>{
  const reducer=F.create(functions);let term=C.parse('(λx.x) f');
  term=reducer.step(term,'normal','left').term;assert.equal(C.hasRedex(term),false);
  assert.equal(reducer.find(term).kind,'unfold');term=reducer.step(term).term;
  assert.ok(C.equal(term,C.parse('λx.x')));assert.equal(reducer.find(term),null);
});
test('unfolding respects lexical shadowing and prevents capture by enclosing binders',()=>{
  const reducer=F.create([{name:'f',term:C.parse('λx.z')}]);
  assert.equal(reducer.find(C.parse('λf.f')),null);
  const result=reducer.step(C.parse('λz.f'));
  assert.deepEqual([...C.freeVars(result.term)],['z']);assert.notEqual(result.term.param,'z');
  assert.equal(reducer.unfoldAt(C.parse('λf.f'),['body']),null);
  assert.equal(reducer.unfoldAt(C.V('unknown'),[]),null);
});
test('function-only quick evaluation demands external definitions and respects local binders',async()=>{
  const result=await Lazy.normalize(C.V('f'),{functions});assert.ok(C.equal(result,C.parse('λx.x')));
  const shadow=await Lazy.normalize(C.parse('λf.f'),{functions});assert.ok(C.equal(shadow,C.parse('λx.x')));
  const aliases=[{name:'f',term:C.V('g')},{name:'g',term:C.parse('λx.x')}];
  assert.ok(C.equal(await Lazy.normalize(C.V('f'),{functions:aliases}),C.parse('λx.x')));
});
test('mixed unfolding and beta history replays, saves and rewinds against frozen definitions',async()=>{
  const original=C.parse('f (f (f (f (f a))))'),reducer=F.create(functions),trace=T.create(original,functions);
  let term=original;
  for(let index=0;index<10;index++){
    const result=reducer.step(term,index%2?'applicative':'normal',index%3?'left':'right');assert.ok(result);
    trace.append(result,result.kind==='unfold'?{unfold:result.path}:result.path);term=result.term;
  }
  assert.equal(reducer.find(term),null);assert.ok(C.equal(term,C.V('a')));
  assert.ok(C.equal((await trace.replay(10)).term,term));
  const snapshot={version:2,draft:C.format(original),functions:[{name:'f',term:C.parse('λx.bad')}],completed:[],mode:'free',level:0,
    session:{original,steps:10,dirty:false,halt:'',functionDefinitions:functions,choices:trace.choices},
    view:{unfoldFunctions:true,numberEncoding:'church',speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''};
  const text=S.encode(snapshot);assert.equal(JSON.parse(text).version,5);
  const restored=S.decode(text,{compact:true});assert.equal(restored.view.unfoldFunctions,true);assert.ok(C.equal(restored.term,term));
  assert.ok(C.equal((await restored.trace.replay(5)).term,(await trace.replay(5)).term));
  for(let index=9;index>=0;index--){const frames=restored.trace.peek(index)?null:await restored.trace.replay(index,{keepRecent:true});restored.trace.rewind(frames);}
  assert.ok(C.equal(restored.trace.peek(0).term,original));
  const invalid=JSON.parse(text);delete invalid.session.functionDefinitions;assert.throws(()=>S.decode(JSON.stringify(invalid)),/归约路径/);
});
test('disabled mode keeps the existing eager expansion and empty registries preserve beta behavior',()=>{
  const term=L.expand(C.parse('f a'),functions);assert.ok(C.equal(term,C.parse('(λx.x) a')));
  for(const strategy of C.STRATEGIES)for(const direction of C.DIRECTIONS){assert.deepEqual(F.create().find(term,strategy,direction),C.findRedex(term,[],strategy,direction));}
});

test('session definitions keep only reachable functions, including indirect dependencies',()=>{
  const definitions=F.capture(C.V('f'),[{name:'f',term:C.V('g')},{name:'g',term:C.parse('λx.x')},{name:'unused',term:C.V('unused')}]);
  assert.deepEqual(definitions.map(fn=>fn.name),['f','g']);assert.deepEqual(F.capture(C.parse('λf.f'),functions),[]);
});

test('legacy mirrors keep the current value without changing the full v5 history',()=>{
  const original=C.parse('(λx.x) f');
  const snapshot=S.decode(S.encode({version:2,draft:'(λx.x) f',functions:[{name:'f',term:C.parse('λx.bad')}],completed:[],mode:'free',level:0,
    session:{original,steps:1,dirty:false,halt:'',functionDefinitions:functions,choices:[[0,[]]]},
    view:{unfoldFunctions:true,numberEncoding:'church',speed:600,scale:1,autoFit:true,historyOpen:false,helpOpen:false,hintOpen:false},selection:{start:0,end:0},error:''}));
  const mirror=S.legacyMirror(snapshot);assert.equal(mirror.version,3);assert.equal(mirror.session.steps,0);
  assert.ok(C.equal(mirror.session.original,C.parse('λx.x')));assert.equal(mirror.session.functionDefinitions,undefined);
  assert.equal(snapshot.version,5);assert.equal(snapshot.session.steps,1);assert.ok(C.equal(snapshot.term,C.V('f')));
});
