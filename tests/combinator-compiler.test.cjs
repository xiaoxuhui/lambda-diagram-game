const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),L=require('../src/library.js'),Compiler=require('../src/combinator-compiler.js');
const expand=result=>L.expand(result.term,result.definitions);
const conflict=(...names)=>error=>error instanceof C.LambdaError&&names.every(name=>error.duplicates?.includes(name));

test('alternating SK and BCKW conversions preserve stable output rather than accumulating abstraction recipes',async()=>{
  for(const first of ['sk','bckw'])for(const source of ['λx.x','λa.λb.b','λx.f (g x)','λn.λf.λx.f (n f x)','λx.f x (g x)','λx.f x','λf.λx.λy.f y x','λx.u x (v x)','(λx.λy.x) y',...Array.from({length:9},(_,n)=>String(n))]){
    const original=C.parse(source),expected=C.normalize(original,10000);assert.equal(expected.status,'normal');
    let term=original,functions=[];const previous=new Map();
    for(let round=0;round<20;round++){
      const basis=round%2?(first==='sk'?'bckw':'sk'):first,normalize=C.normalize,step=C.step;let result;
      try{C.normalize=C.step=()=>{throw Error('conversion must not run the Lambda program');};result=await Compiler.compileTerm(term,{basis,simplify:true,functions,signal:AbortSignal.timeout(3000)});}
      finally{C.normalize=normalize;C.step=step;}
      functions.push(...result.definitions);
      if(previous.has(basis)){assert.equal(result.source,previous.get(basis),source+' '+basis+' round '+round);assert.equal(result.definitions.length,0);}
      previous.set(basis,result.source);term=L.expand(result.term,functions);
    }
    assert.ok(C.equal(C.normalize(term,10000).term,expected.term),source);
  }
});

test('Church successor absorbs the two-argument eta wrapper without identifying arbitrary functions',async()=>{
  let functions=[];for(const [name,source] of [['b','λf g x.f (g x)'],['c','λf x y.f y x'],['i','λx.x'],['inc','λn f x.f (n f x)']])functions=L.add(functions,name,source);
  const h='c (b c (b (b b) (c b i))) i';
  for(const basis of ['optimized','bckw']){
    const bare=await Compiler.compileTerm(L.expand(C.parse('inc'),functions),{basis});
    const term=L.expand(C.parse(`b inc (${h})`),functions),normalize=C.normalize,step=C.step;let result;
    try{C.normalize=C.step=()=>{throw Error('do not evaluate during conversion');};result=await Compiler.compileTerm(term,{basis});}
    finally{C.normalize=normalize;C.step=step;}
    assert.equal(result.source,bare.source);assert.equal(result.source,basis==='optimized'?'s b':'b w (c (b b b))');
    assert.ok(C.equal(normalize(expand(result),10000).term,normalize(term,10000).term));
    for(const n of [0,1,3,7])assert.equal(C.churchNumber(normalize(C.A(expand(result),C.parse(String(n))),10000).term),n+1);
    for(const left of ['n','(λx.x)','(λa.λb.a)']){
      const original=L.expand(C.parse(`b ${left} (${h})`),functions),compiled=await Compiler.compileTerm(original,{basis});
      assert.ok(C.equal(normalize(expand(compiled),10000).term,normalize(original,10000).term));
      assert.ok(!C.equal(normalize(expand(compiled),10000).term,normalize(C.parse(left),10000).term));
    }
    const wrapper=await Compiler.compileTerm(L.expand(C.parse(h),functions),{basis});
    assert.ok(C.equal(normalize(expand(wrapper),1000).term,C.parse('λf.λx.λy.f x y')));
  }
});

test('BCKW simplifies false applications, partial functions and nested composition without executing Lambda',async()=>{
  let functions=[];for(const [name,source] of [['b','λf g x.f (g x)'],['c','λf x y.f y x'],['k','λa b.a'],['w','λf x.f x x'],['i','λx.x']])functions=L.add(functions,name,source);
  for(const [source,expected] of [
    ['c k x','w k'],['b i (b f g)','b f g'],['b (b f g) i','b f g'],['w (k (b f g))','b f g'],
    ['c (c (b f))','b f'],['c b i','b (w k)'],['b (b f g) h','b f (b g h)'],['w (k (k p))','k p'],
    ['b (b f g) (k p)','k (f (g p))']
  ]){
    const term=L.expand(C.parse(source),functions),normalize=C.normalize,step=C.step;let result;
    try{C.normalize=C.step=()=>{throw Error('conversion must use structure rules');};result=await Compiler.compileTerm(term,{basis:'bckw',signal:AbortSignal.timeout(3000)});}
    finally{C.normalize=normalize;C.step=step;}
    assert.equal(result.source,expected,source);
    assert.ok(C.equal(C.normalize(expand(result),10000).term,C.normalize(term,10000).term),source);
  }
  for(const source of ['b i f','b f i','w (k f)','c (c f)','c (c (b f g))','c (c (k f))']){
    const term=L.expand(C.parse(source),functions),result=await Compiler.compileTerm(term,{basis:'bckw'});
    const actual=C.normalize(expand(result),10000),before=C.normalize(term,10000);
    assert.equal(actual.status,'normal');assert.ok(C.equal(actual.term,before.term),source+' must retain its leading lambdas');
  }
});

test('BCKW automatically uses compact cases for booleans, numerals, linear composition and duplication',async()=>{
  for(const [source,expected] of [['λa.λb.b','c k'],['0','c k'],['1','b (w k)'],['2','w b'],['4','b (w b) (w b)'],['λx.f (g x)','b f g'],['λx.f x a','c f a'],['λx.f x x','w f'],['λx.x x','w (w k)']]){
    const term=C.parse(source),result=await Compiler.compileTerm(term,{basis:'bckw'});assert.equal(result.source,expected);
    assert.ok(C.equal(C.normalize(expand(result),100000).term,C.normalize(term,100000).term),source);
  }
  for(let n=0;n<=16;n++){
    const result=await Compiler.compileTerm(C.parse(String(n)),{basis:'bckw',simplify:true}),normal=C.normalize(expand(result),200000);
    assert.equal(normal.status,'normal');assert.equal(C.churchNumber(normal.term),n);assert.ok(result.definitions.every(fn=>['b','c','k','w'].includes(fn.name)));
  }
});

test('BCKW structure rules preserve beta normal forms without treating free functions as lambda values',async()=>{
  let functions=[];for(const [name,source] of [['b','λf.λg.λx.f (g x)'],['c','λf.λx.λy.f y x'],['k','λa.λb.a'],['w','λf.λx.f x x'],['i','λx.x']])functions=L.add(functions,name,source);
  for(const source of ['k p q','b f g x','c f x y','w f x','b (k p) q','b f (k p)','b i b','b b i','c (k p) q','c (c b)','c (c k)','c (c w)','c (c i)','w (k b)','w (k i)','w (c k)','w (b f i)','b (b f i) g','b f (b g i)','c (b f i) a','b i f','b f i','c (c f)']){
    const term=L.expand(C.parse(source),functions),result=await Compiler.compileTerm(term,{basis:'bckw'}),before=C.normalize(term,100000),after=C.normalize(expand(result),100000);
    assert.equal(after.status,'normal',source);assert.ok(C.equal(after.term,before.term),source);
  }
  for(const source of ['λx.f x','λx.λy.f x y']){
    const term=C.parse(source),result=await Compiler.compileTerm(term,{basis:'bckw'});assert.notEqual(result.source,'f');assert.ok(C.equal(C.normalize(expand(result),100000).term,term));
  }
  const custom=L.add([],'c','λx.x');await assert.rejects(Compiler.compileTerm(C.parse('0'),{basis:'bckw',functions:custom}),conflict('c'));assert.equal(custom[0].source,'λx.x');
});

test('BCKW special cases finish compilation without evaluating omega or W W W',async()=>{
  const w=C.parse('λf.λx.f x x'),loop=C.A(C.A(w,w),w),normalize=C.normalize,step=C.step;
  try{C.normalize=C.step=()=>{throw Error('do not run the Lambda input');};
    const result=await Compiler.compileTerm(loop,{basis:'bckw'});assert.equal(result.source,'w w w');
    assert.ok((await Compiler.compileTerm(C.parse('(λx.x x) (λx.x x)'),{basis:'bckw'})).source.length);
  }finally{C.normalize=normalize;C.step=step;}
});

test('identity is output as i while saved id and conflicting i functions are preserved',async()=>{
  const functions=L.add([],'id','λx.x'),term=C.parse('λx.x');
  const result=await Compiler.compileTerm(term,{functions});assert.equal(result.source,'i');assert.equal(result.definitions[0].name,'i');assert.equal(functions[0].name,'id');
  const reused=await Compiler.compileTerm(term,{functions:[...functions,...result.definitions]});assert.equal(reused.source,'i');assert.equal(reused.definitions.length,0);
  const occupied=L.add(functions,'i','λx.λy.x');await assert.rejects(Compiler.compileTerm(term,{functions:occupied}),conflict('i'));assert.equal(occupied[1].source,'λx.λy.x');
});

test('BCKW conversion emits only its four primitives and preserves beta normal forms',async()=>{
  for(const source of ['λx.x','λa.λb.a','λa.λb.b','λf.λg.λx.f x (g x)','λf.λg.λx.f (g x)','λf.λx.λy.f y x','λf.λx.f x x','λx.f x','λx.f (g x)','λx.f x a','λx.x x','λx.λx.x','λx.(λy.x y)','(λx.λy.x) y','0','1','2','3','4']){
    const term=C.parse(source),result=await Compiler.compileTerm(term,{basis:'bckw'});
    assert.ok(!result.source.includes('λ'));assert.ok(result.definitions.every(fn=>['b','c','k','w'].includes(fn.name)),source);
    assert.ok([...C.freeVars(result.term)].every(name=>['b','c','k','w'].includes(name)||C.freeVars(term).has(name)));
    const actual=C.normalize(expand(result),100000),expected=C.normalize(term,100000);
    assert.equal(actual.status,'normal',source);assert.ok(C.equal(actual.term,expected.term),source);
  }
  assert.equal((await Compiler.compileTerm(C.parse('λx.x'),{basis:'bckw'})).source,'w k');
  assert.equal((await Compiler.compileTerm(C.parse('λf.λg.λx.f x (g x)'),{basis:'bckw'})).source,'b (b w) (b c (b b))');
});

test('BCKW primitives are reused, protected against conflicts and do not capture free names',async()=>{
  const functions=L.add([],'w','λf.λx.f x x'),term=C.parse('λx.x');
  const first=await Compiler.compileTerm(term,{basis:'bckw',functions});assert.equal(first.source,'w k');assert.ok(first.ready.includes('w'));
  const again=await Compiler.compileTerm(term,{basis:'bckw',functions:[...functions,...first.definitions]});assert.equal(again.definitions.length,0);assert.equal(again.source,'w k');
  const open=C.parse('λx.b x (w x)');await assert.rejects(Compiler.compileTerm(open,{basis:'bckw'}),conflict('b','w'));
  await assert.rejects(Compiler.compileTerm(term,{basis:'bckw',functions:L.add([],'w','λx.x')}),conflict('w'));
  const controller=new AbortController();controller.abort();await assert.rejects(Compiler.compileTerm(term,{basis:'bckw',signal:controller.signal}),{name:'AbortError'});
});

test('composition is named b in converter output, without renaming saved mathematical functions',async()=>{
  const functions=L.add([],'mul','λm.λn.λf.m (n f)'),original=functions[0];
  const result=await Compiler.compileTerm(C.parse('λf.λg.λx.f (g x)'),{functions});
  assert.equal(result.source,'b');assert.deepEqual(result.definitions.map(fn=>fn.name),['b']);assert.equal(functions[0],original);assert.equal(functions[0].name,'mul');
});

test('mul mul id reduces to mul by definition, including nested expressions and renamed functions',async()=>{
  const mul='(λm.λn.λf.m (n f))',id='(λx.x)',source=`${mul} ${mul} ${id}`,term=C.parse(source);
  assert.ok(C.equal(C.normalize(term,1000).term,C.parse(mul)));
  const named=await Compiler.compileTerm(term);assert.equal(named.source,'b');assert.deepEqual(named.used,['b']);
  const nested=await Compiler.compileTerm(C.parse(`(${source}) ${mul} ${id}`));assert.equal(nested.source,'b');
  const sk=await Compiler.compileTerm(term,{basis:'sk',simplify:true});assert.equal(sk.source,'s (k s) k');
  assert.ok(C.equal(C.normalize(expand(sk),1000).term,C.parse(mul)));
  const functions=L.add([],'compose','λa.λb.λc.a (b c)');
  assert.equal((await Compiler.compileTerm(term,{functions})).source,'b');assert.equal(functions[0].name,'compose');
  const other=C.parse(`${mul} ${mul} (λa.λb.a)`),untouched=await Compiler.compileTerm(other);
  assert.notEqual(untouched.source,'b');assert.ok(C.equal(C.normalize(expand(untouched),1000).term,C.normalize(other,1000).term));
});

test('simplified SK covers combinators and the Church numeral family with the same beta normal forms',async()=>{
  const sources=['λx.x','λa.λb.a','λa.λb.b','λx.λx.x',...CompilerSourceCombinators(),...Array.from({length:13},(_,n)=>String(n))];
  for(const source of sources){
    const term=C.parse(source),standard=await Compiler.compileTerm(term,{basis:'sk'}),result=await Compiler.compileTerm(term,{basis:'sk',simplify:true});
    assert.ok(result.definitions.every(fn=>['s','k'].includes(fn.name)));assert.ok(C.inspect(result.term).nodes<=C.inspect(standard.term).nodes,source);
    const actual=C.normalize(expand(result),100000),expected=C.normalize(term,100000);
    assert.equal(actual.status,'normal',source);assert.ok(C.equal(actual.term,expected.term),source);
  }
  assert.equal((await Compiler.compileTerm(C.parse('λa.λb.b'),{basis:'sk',simplify:true})).source,'s k');
  assert.equal((await Compiler.compileTerm(C.parse('λa.λb.a'),{basis:'sk',simplify:true})).source,'k');
  assert.equal((await Compiler.compileTerm(C.parse('λf.λg.λx.f x (g x)'),{basis:'sk',simplify:true})).source,'s');
});
function CompilerSourceCombinators(){return ['λf.λg.λx.f (g x)','λf.λx.λy.f y x','λf.λx.f x x'];}

test('generic SK simplification handles constants and applications without unsafe eta contraction',async()=>{
  for(const f of ['f','s','k','(λu.u)','(λa.λb.a)'])for(const g of ['g','(λu.u)','(λa.λb.b)']){
    if(['s','k'].includes(f)){await assert.rejects(Compiler.compileTerm(C.parse(`λx.${f} x (${g} x)`),{basis:'sk',simplify:true}),conflict(f));continue;}
    const term=C.parse(`λx.${f} x (${g} x)`),result=await Compiler.compileTerm(term,{basis:'sk',simplify:true});
    assert.ok(C.equal(C.normalize(expand(result),100000).term,C.normalize(term,100000).term),C.format(term));
  }
  for(const source of ['(λa.λb.a) f g','(λf.λg.λx.f x (g x)) (λa.λb.a) (λx.x)','(λf.λg.λx.f x (g x)) ((λa.λb.a) f) ((λa.λb.a) g)']){
    const term=C.parse(source),result=await Compiler.compileTerm(term,{basis:'sk',simplify:true});
    assert.ok(C.equal(C.normalize(expand(result),10000).term,C.normalize(term,10000).term));
  }
  assert.equal((await Compiler.compileTerm(C.parse('λx.f x'),{basis:'sk',simplify:true})).source,'s (k f) (s k k)');
  const term=C.parse('λx.s x (k x)');await assert.rejects(Compiler.compileTerm(term,{basis:'sk',simplify:true}),conflict('s','k'));
});

test('simplified SK does not execute an embedded Lambda evaluator or loop on omega',async()=>{
  const normalize=C.normalize,step=C.step;
  try{C.normalize=C.step=()=>{throw Error('do not run the Lambda program');};
    const result=await Compiler.compileTerm(C.parse('(λx.x x) (λx.x x)'),{basis:'sk',simplify:true});assert.ok(result.source.length);
  }finally{C.normalize=normalize;C.step=step;}
  const controller=new AbortController();controller.abort();await assert.rejects(Compiler.compileTerm(C.parse('λx.x'),{basis:'sk',simplify:true,signal:controller.signal}),{name:'AbortError'});
});

test('SK compilation uses only s and k while preserving normal forms and free variables',async()=>{
  for(const source of ['λx.x','λa.λb.a','λf.λg.λx.f x (g x)','λx.f x','λx.f (g x)','λx.f x a','λx.x x','λx.λx.x','λx.(λy.x y)','(λx.λy.x) y']){
    const term=C.parse(source),result=await Compiler.compileTerm(term,{basis:'sk'}),linked=expand(result);
    assert.ok(!result.source.includes('λ'));assert.ok(result.definitions.every(fn=>['s','k'].includes(fn.name)));
    assert.ok([...C.freeVars(result.term)].every(name=>['s','k'].includes(name)||C.freeVars(term).has(name)));
    const original=C.normalize(term,50000),compiled=C.normalize(linked,50000);assert.equal(compiled.status,'normal',source);assert.ok(C.equal(compiled.term,original.term),source);
    assert.deepEqual([...C.freeVars(linked)].sort(),[...C.freeVars(term)].sort());
  }
  assert.equal((await Compiler.compileTerm(C.parse('λx.x'),{basis:'sk'})).source,'s k k');
  for(const source of ['λa.λb.b','λf.λx.x','0']){
    const result=await Compiler.compileTerm(C.parse(source),{basis:'sk'});
    assert.equal(result.source,'k (s k k)');assert.ok(C.equal(C.normalize(expand(result),100).term,C.parse('λa.λb.b')));
  }
});

test('SK conversion follows the same abstraction rules for known functions without shortcuts',async()=>{
  for(const [source,expected] of [['λa.λb.a','s (k k) (s k k)'],['λx.f x','s (k f) (s k k)'],['λx.f','k f']]){
    assert.equal((await Compiler.compileTerm(C.parse(source),{basis:'sk'})).source,expected);
  }
  const source='(λx.x) f',compiled=await Compiler.compileTerm(C.parse(source),{basis:'sk'});
  assert.equal(compiled.source,'s k k f','conversion does not beta-reduce the application');
});

test('SK definitions are added only when missing and collisions never overwrite or rename user functions',async()=>{
  const occupied=L.add([],'s','λx.x');await assert.rejects(Compiler.compileTerm(C.parse('λx.x'),{functions:occupied,basis:'sk'}),conflict('s'));assert.equal(occupied.length,1);
  const original=L.add([],'s','λf.λg.λx.f x (g x)'),first=await Compiler.compileTerm(C.parse('λx.x'),{functions:original,basis:'sk'});
  assert.equal(first.source,'s k k');assert.equal(original.length,1);
  const functions=[...original,...first.definitions],again=await Compiler.compileTerm(C.parse('λx.x'),{functions,basis:'sk'});
  assert.equal(again.definitions.length,0);assert.equal(again.source,'s k k');
  await assert.rejects(Compiler.compileTerm(C.parse('λx.s x (k x)'),{functions,basis:'sk'}),conflict('s','k'));
});
test('external compilation preserves beta normal forms, shadowing and free variables without eta contraction',async()=>{
  for(const source of ['λx.x','λx.a','λx.f x','λx.f (g x)','λx.f x a','λx.f x (g x)','λx.f x x','λx.x x','λx.λx.x','λx.(λy.x y)','λx.u x (v x)','(λx.λy.x) y']){
    const term=C.parse(source),result=await Compiler.compileTerm(term),linked=expand(result);
    assert.ok(!result.source.includes('λ'),source+' produces calls, not an embedded compiler');
    const before=C.normalize(term,10000),after=C.normalize(linked,10000);
    assert.equal(after.status,'normal',source);assert.ok(C.equal(after.term,before.term),source);
    assert.deepEqual([...C.freeVars(linked)].sort(),[...C.freeVars(term)].sort(),source);
  }
});
test('other functions actually compile to s, c and w, with linear composition preferred',async()=>{
  const nonlinear=await Compiler.compileTerm(C.parse('λx.f x (g x)'));assert.ok(nonlinear.used.includes('s'));
  const exchange=await Compiler.compileTerm(C.parse('λx.f x a'));assert.ok(exchange.used.includes('c'));
  const square=await Compiler.compileTerm(C.parse('λn.(λm n f.m (n f)) n n'));assert.equal(square.source,'w b');
  const linear=await Compiler.compileTerm(C.parse('λx.f (g x)'));assert.ok(!linear.used.includes('s'));assert.ok(!linear.used.includes('w'));
  const number=C.normalize(C.A(expand(square),C.parse('3')),10000);assert.equal(C.churchNumber(number.term),9);
});
test('existing definitions are reused and user names and free variables are protected',async()=>{
  const functions=[{name:'s',source:'λx.x',term:C.parse('λx.x')},{name:'flip',source:'λf x y.f y x',term:C.parse('λf x y.f y x')}];
  const swap=await Compiler.compileTerm(C.parse('λf x y.f y x'),{functions});assert.equal(swap.source,'flip');assert.equal(swap.definitions.length,0);
  await assert.rejects(Compiler.compileTerm(C.parse('λx.s x (g x)'),{functions}),conflict('s'));assert.equal(functions[0].source,'λx.x');
});
test('compiler performs no Lambda evaluation and cancellation is supported',async()=>{
  const normalize=C.normalize,step=C.step;
  try{C.normalize=C.step=()=>{throw Error('compiler must not evaluate');};const result=await Compiler.compileTerm(C.parse('λx.f x (g x)'));assert.ok(result.used.includes('s'));}
  finally{C.normalize=normalize;C.step=step;}
  const controller=new AbortController();controller.abort();await assert.rejects(Compiler.compileTerm(C.parse('λx.x'),{signal:controller.signal}),{name:'AbortError'});
});
