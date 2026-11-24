const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),L=require('../src/library.js'),P=require('../src/presets.js'),E=require('../src/data-encoding.js'),D=require('../src/decimal.js'),Lazy=require('../src/lazy-eval.js'),F=require('../src/function-reduction.js'),G=require('../src/guide.js');
test('linking removes only declared helper bindings and never evaluates their bodies',()=>{
  const source=C.parse('(λforce.λpair.λx.force (pair x)) (λv.v)'),normalize=C.normalize,step=C.step;
  try{C.normalize=C.step=()=>{throw Error('linking must not evaluate');};
    const patterns=[{name:'force',term:C.parse('λv.v')}],linked=L.captureHelpers(source,patterns);
    assert.ok(C.equal(F.expand(linked.term,linked.definitions),C.parse('λpair.λx.(λv.v) (pair x)')));
    const unknown=C.parse('(λforce.force) unknown');assert.ok(C.equal(L.captureHelpers(unknown,patterns).term,unknown));
    const omega=C.parse('(λx.x x) (λx.x x)');assert.ok(C.equal(L.captureHelpers(omega,patterns).term,omega));
  }finally{C.normalize=normalize;C.step=step;}
});
test('linking preserves free variables when a helper crosses a data binder',()=>{
  const captured=L.captureHelpers(C.parse('(λhelper.λfree.helper) (λx.free)'),[{name:'helper',term:C.parse('λx.free')}]),t=F.expand(captured.term,captured.definitions);
  assert.deepEqual([...C.freeVars(t)],['free']);assert.ok(C.equal(t,C.parse('λother.λx.free')));
});
test('plain linking retains private helper scopes and never moves the actual call underneath them',()=>{
  const before=C.parse('(λl.(λid.λn.id (id l)) (λx.x)) [1,2,3] 2'),step=C.step,normalize=C.normalize;let after;
  try{C.step=C.normalize=()=>{throw Error('preparation must not evaluate data');};after=L.linkHelpersInPlace(before,[{name:'id',term:C.parse('λx.x')}]);}
  finally{C.step=step;C.normalize=normalize;}
  assert.ok(C.equal(after,before),'a shared helper stays in its original private scope');
  const doc=G.lesson(P.examples.find(e=>e.listOperation?.name==='nth')),functions=L.importDefinitions([],doc.symbols,G.libraryNames(doc)).functions;
  for(const source of ['nth [1,2,3]','nth [1,2,3] 2']){
    const original=L.expand(E.parse(source).term,functions),prepared=P.preparePlain(original),args=[];let head=prepared;
    while(head.type==='app'){args.unshift(head.arg);head=head.fn;}
    assert.equal(head.param,'l');assert.ok(C.equal(args[0],C.parse('[1,2,3]')));assert.equal(args.length,source.endsWith(' 2')?2:1);assert.equal(C.step(prepared).param,'l');
    if(args.length===2)assert.equal(C.churchNumber(args[1]),2);
  }
  const scoped=L.linkHelpersInPlace(C.parse('λfree.(λhelper.λfree.helper) (λx.free)'),[{name:'helper',term:C.parse('λx.free')}]);assert.ok(C.equal(scoped,C.parse('λouter.λinner.λx.outer')));
});
test('deep diagram preparation retains every node without using the JavaScript call stack',()=>{
  const numeral=C.parse('20000');assert.equal(P.preparePlain(numeral),numeral);
  const program=C.A(C.L('helper',C.A(C.V('helper'),numeral)),C.parse('λx.x'));
  const compiled=L.captureHelpers(program,[{name:'helper',term:C.parse('λx.x')}]);
  const restored=L.closeHelpers(compiled.term,compiled.definitions);assert.ok(C.equal(restored,C.A(C.parse('λx.x'),numeral)));
  let deep=C.A(C.L('helper',C.V('helper')),C.parse('λx.x'));
  for(let i=0;i<10000;i++)deep=C.L('p'+i,deep);
  const closure=L.captureHelpers(deep,[{name:'helper',term:C.parse('λx.x')}]);assert.equal(closure.definitions.length,1);
  let expected=C.parse('λx.x');for(let i=0;i<10000;i++)expected=C.L('p'+i,expected);
  assert.ok(C.equal(L.closeHelpers(closure.term,closure.definitions),expected));
});
test('captured helpers retain lexical data and respect shadowing in every reduction order',()=>{
  const source=C.parse('(λn.(λhelper.λn.helper) (λx.n)) 4 9'),compiled=L.captureHelpers(source,[{name:'helper',term:C.parse('λx.n')}]);
  for(const strategy of C.STRATEGIES)for(const direction of C.DIRECTIONS){
    const reducer=F.create(compiled.definitions);let t=compiled.term,r;
    for(let i=0;i<100&&(r=reducer.step(t,strategy,direction));i++)t=r.term;
    assert.ok(C.equal(t,C.parse('λx.4')),strategy+' '+direction);
  }
});
test('named pair division starts with its real data parameters instead of helper setup',async()=>{
  const example=P.examples.find(e=>e.name.startsWith('序对除法')),doc=G.lesson(example),functions=L.importDefinitions([],doc.symbols,null,{exact:true}).functions,before=E.parse(P.inputSourceFor(example)).term,call=E.parse(doc.compact).term,compiled=P.prepare(call,F.capture(call,functions)),after=compiled.term;
  const args=[];let main=after;while(main.type==='app'){args.unshift(main.arg);main=main.fn;}
  assert.deepEqual(args.map(C.churchNumber),[7,2]);assert.equal(main.type,'var');assert.ok(compiled.definitions.some(fn=>fn.name===main.name));
  assert.equal(C.inspect(after).nodes,args.reduce((sum,arg)=>sum+C.inspect(arg).nodes,0)+3);
  const a=C.normalize(before,30000),b=await Lazy.normalize(after,{functions:compiled.definitions});assert.ok(C.equal(a.term,b));
});
test('named scientific calls keep dependencies separate from precision and input',async()=>{
  const example=P.examples.find(e=>e.decimalOperation==='SIN'),doc=G.lesson(example),functions=L.importDefinitions([],doc.symbols,null,{exact:true}).functions,call=E.parse(doc.compact).term,compiled=P.prepare(call,F.capture(call,functions)),term=compiled.term;
  const args=[];let main=term;while(main.type==='app'){args.unshift(main.arg);main=main.fn;}
  assert.equal(args.length,2);assert.equal(C.churchNumber(args[0]),6);
  assert.ok(C.inspect(term).nodes<100,'do not duplicate the scientific helper graph into the diagram');
  assert.ok(compiled.definitions.reduce((sum,fn)=>sum+C.inspect(fn.term).nodes,0)<6000);
  const value=await Lazy.normalize(C.A(C.A(main,C.parse('2')),D.encodeLiteral('0')),{functions:compiled.definitions,signal:AbortSignal.timeout(15000),onPause:()=>true});
  assert.equal(D.format(D.read(value)),'0');
});
test('plain conversion has no aliases or implicit functions and keeps its size bounded',async()=>{
  const example=P.examples.find(e=>e.decimalOperation==='SIN'),source=E.parse(P.inputSourceFor(example)).term,plain=P.preparePlain(source);
  assert.equal(C.freeVars(plain).size,0);assert.ok(C.inspect(plain).nodes<10000);
  const result=await Lazy.normalize(plain,{signal:AbortSignal.timeout(15000),onPause:()=>true});assert.equal(D.format(D.read(result)),'0.479425');
  const pair=P.examples.find(e=>e.name.startsWith('序对除法')),term=P.preparePlain(E.parse(P.inputSourceFor(pair)).term);
  assert.ok(C.equal(C.normalize(term,30000).term,C.parse(pair.expected)));
});
