(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  const definitions=[
    ['i','i','λx.x'],['k','true','λa b.a'],['b','b','λf g x.f (g x)'],
    ['c','c','λf x y.f y x'],['s','s','λf g x.f x (g x)'],['w','w','λf x.f x x']
  ].map(([key,name,source])=>({key,name,source:C.explicitLambdas(source),term:C.parse(source)}));
  const combinators=new Map(definitions.map(d=>[d.key,{type:'combinator',key:d.key}]));
  const app=(fn,arg)=>({type:'app',fn,arg}),call=(key,...args)=>args.reduce(app,combinators.get(key));
  const SK={s:combinators.get('s'),k:combinators.get('k')};
  const falseLambda=C.parse('λa.λb.b');
  SK.i=call('s',SK.k,SK.k);SK.false=call('s',SK.k);SK.b=call('s',call('k',SK.s),SK.k);
  SK.c=call('s',app(app(SK.b,SK.b),SK.s),call('k',SK.k));SK.w=call('s',SK.s,SK.false);
  const BCKW={i:call('w',combinators.get('k')),s:call('b',call('b',combinators.get('w')),call('b',combinators.get('c'),call('b',combinators.get('b'))))};
  BCKW.false=call('c',combinators.get('k'));BCKW.one=call('b',BCKW.i);BCKW.two=call('w',combinators.get('b'));
  const selfApply=C.parse('λx.x x');
  const successor=call('s',combinators.get('b'));
  const successorBCKW=call('b',combinators.get('w'),call('c',call('b',combinators.get('b'),combinators.get('b'))));
  const canonicalFalse=call('k',combinators.get('i'));
  function* lowerBasis(term,basis,specialize=true){
    const pending=[{term}],values=[];
    while(pending.length){yield;const entry=pending.pop(),t=entry.term;
      if(entry.finish){const right=values.pop(),left=values.pop();values.push(entry.finish==='b'?call('s',call('k',left),right):app(left,right));}
      else if(specialize&&same(t,canonicalFalse))values.push(basis==='sk'?SK.false:BCKW.false);
      else if(specialize&&basis==='bckw'&&same(t,successor))values.push(successorBCKW);
      else if(specialize&&basis==='sk'&&t.type==='app'&&t.fn.type==='app'&&isKey(t.fn.fn,'b'))pending.push({finish:'b'},{term:t.arg},{term:t.fn.arg});
      else if(t.type==='app')pending.push({term:t,finish:true},{term:t.arg},{term:t.fn});
      else values.push(t.type==='combinator'?(basis==='sk'?SK[t.key]:BCKW[t.key])??t:t);
    }return values[0];
  }
  const isKey=(term,key)=>term?.type==='combinator'&&term.key===key;
  function same(a,b){
    const pending=[[a,b]];while(pending.length){const [x,y]=pending.pop();if(x===y)continue;if(!x||!y||x.type!==y.type)return false;
      if(x.type==='app')pending.push([x.fn,y.fn],[x.arg,y.arg]);else if(x.type==='combinator'?x.key!==y.key:x.name!==y.name)return false;
    }return true;
  }
  // Both terms beta-reduce to λf.λx.λy.f x y. Retain all three
  // lambdas: this is not the identity on an arbitrary free variable.
  const eta2=call('b',call('b',combinators.get('i')));
  const eta2Long=call('c',call('b',combinators.get('c'),call('b',call('b',combinators.get('b')),call('c',combinators.get('b'),combinators.get('i')))),combinators.get('i'));
  const constant=term=>term?.type==='app'&&isKey(term.fn,'k')?term.arg:same(term,SK.false)?SK.i:null;
  // These rules preserve beta normal forms, including the number of lambdas.
  // In particular S(K f)I is NOT shortened to an unknown free variable f.
  function shrink(term,sk=true){
    if(term.type!=='app')return term;
    const left=term.fn,right=term.arg;
    if(same(term,eta2Long))return eta2;
    // S B is Church successor; it consumes its input with two arguments.
    // B (S B) (λf x y.f x y) therefore beta-reduces back to S B.
    if(left.type==='app'&&isKey(left.fn,'b')&&same(right,eta2)&&left.arg.type==='app'&&isKey(left.arg.fn,'s')&&isKey(left.arg.arg,'b'))return left.arg;
    if(left.type==='app'&&isKey(left.fn,'b')&&isKey(left.arg,'b')&&isKey(right,'i'))return combinators.get('b');
    if(!sk)return term;
    if(left.type==='app'&&same(left.fn,SK.b)&&same(left.arg,SK.b)&&same(right,SK.i))return SK.b;
    if(left.type==='app'&&isKey(left.fn,'k'))return left.arg; // K p q = p
    if(isKey(left,'k')&&same(right,SK.i))return SK.false; // K I = S K
    if(left.type==='app'&&isKey(left.fn,'s')){
      const first=left.arg;
      if(isKey(first,'k')&&!isKey(right,'k'))return SK.i; // S K p = I
      const p=constant(first),q=constant(right);
      if(p!==null&&q!==null)return call('k',app(p,q)); // S(K p)(K q) = K(p q)
      if(p!==null&&same(right,SK.i)&&Object.values(SK).some(value=>same(p,value)))return p;
    }
    return term;
  }
  const identityBCKW=term=>isKey(term,'i')||same(term,BCKW.i);
  const bckwArities=[[canonicalFalse,2],[BCKW.i,1],[BCKW.s,3],[BCKW.false,2],[BCKW.one,2],[BCKW.two,2]];
  // A conservative count of leading lambdas, without evaluating the input.
  // Partly applied primitives are functions too; arbitrary free names are not.
  function arityBCKW(term){
    let applied=0,node=term;
    while(node){
      const known=bckwArities.find(([value])=>same(node,value));
      if(known)return Math.max(0,known[1]-applied);
      if(node.type==='combinator')return Math.max(0,({i:1,b:3,c:3,k:2,w:2,s:3}[node.key]??0)-applied);
      if(node.type!=='app')return 0;
      applied++;node=node.fn;
    }return 0;
  }
  const functionBCKW=term=>arityBCKW(term)>=1;
  const function2BCKW=term=>arityBCKW(term)>=2;
  const etaBCKW=term=>term?.type==='app'&&term.fn.type==='app'&&isKey(term.fn.fn,'b')&&identityBCKW(term.arg)?term.fn.arg:null;
  function shrinkBCKW(term){
    if(term.type!=='app')return term;
    const left=term.fn,right=term.arg;
    if(left.type==='app'&&isKey(left.fn,'k'))return left.arg;
    if(left.type==='app'&&left.fn.type==='app'){
      const head=left.fn.fn,p=left.fn.arg,q=left.arg;
      if(isKey(head,'b'))return app(p,app(q,right));
      if(isKey(head,'c'))return app(app(p,right),q);
    }
    if(left.type==='app'&&isKey(left.fn,'w')){
      if(isKey(left.arg,'k'))return right;
      // Duplicating a W argument can itself be a loop (W W W). Keep that
      // expression for the normal evaluator instead of running it here.
      if(right.type!=='app'&&!isKey(right,'w'))return app(app(left.arg,right),right);
    }
    if(left.type==='app'&&isKey(left.fn,'b')){
      const p=left.arg;
      if((p.type==='app'&&isKey(p.fn,'k'))||same(p,BCKW.false))return p;
      if(right.type==='app'&&isKey(right.fn,'k'))return call('k',app(p,right.arg));
      if(identityBCKW(p)&&functionBCKW(right))return right;
      if(identityBCKW(right)&&functionBCKW(p))return p;
      const first=etaBCKW(p),second=etaBCKW(right);
      if(first!==null)return call('b',first,right);
      if(second!==null)return call('b',p,second);
      // Right associate composition, exposing constants and identities inside.
      if(p.type==='app'&&p.fn.type==='app'&&isKey(p.fn.fn,'b'))return call('b',p.fn.arg,call('b',p.arg,right));
    }
    if(left.type==='app'&&isKey(left.fn,'c')){
      const p=left.arg;if(isKey(p,'k'))return combinators.get('i'); // C K x = I
      if(isKey(p,'b')&&identityBCKW(right))return call('b',combinators.get('i')); // C B I = B I
      if(same(p,BCKW.false))return call('k',right);
      const value=p.type==='app'&&isKey(p.fn,'k')?p.arg:null;
      if(value!==null)return call('k',app(value,right));
      const expanded=etaBCKW(p);if(expanded!==null)return call('c',expanded,right);
    }
    if(isKey(left,'c')&&right.type==='app'&&isKey(right.fn,'c')&&function2BCKW(right.arg))return right.arg;
    if(isKey(left,'w')){
      if(same(right,BCKW.false))return combinators.get('i');
      if(right.type==='app'&&isKey(right.fn,'k')&&functionBCKW(right.arg))return right.arg;
      const expanded=etaBCKW(right);if(expanded!==null)return call('w',expanded);
    }
    return term;
  }
  // Recognize the inverse of both emitters before introducing another basis.
  // The shared representation keeps I/B/C/S/W as primitives; generated basis
  // recipes never become fresh Lambda abstractions on the next conversion.
  const recipeAliases=[
    [SK.i,combinators.get('i')],[SK.false,canonicalFalse],[SK.b,combinators.get('b')],
    [app(app(combinators.get('s'),call('b',combinators.get('b'),combinators.get('s'))),call('k',combinators.get('k'))),combinators.get('c')],
    [call('s',combinators.get('s'),canonicalFalse),combinators.get('w')],
    [BCKW.i,combinators.get('i')],[BCKW.false,canonicalFalse],[BCKW.s,combinators.get('s')],
    [successorBCKW,successor],
    [eta2Long,eta2],
    [call('c',call('b',combinators.get('c'),call('b',call('b',combinators.get('b')),call('b',combinators.get('i')))),combinators.get('i')),eta2]
  ];
  function canonicalRewrite(term){
    for(const [recipe,value] of recipeAliases)if(same(term,recipe))return value;
    if(term.type==='app'&&isKey(term.fn,'i'))return term.arg;
    if(term.type==='app'&&term.fn.type==='app'&&isKey(term.fn.fn,'s')&&term.fn.arg.type==='app'&&isKey(term.fn.arg.fn,'k'))return call('b',term.fn.arg.arg,term.arg);
    const shorter=shrink(term,false);
    return shorter!==term?shorter:shrinkBCKW(term);
  }
  function* simplifySteps(term,sk=true,rewrite=null){
    const work=[{term}],values=[];
    while(work.length){
      yield;const entry=work.pop(),t=entry.term;
      if(entry.finish){const right=values.pop(),left=values.pop(),joined=left===t.fn&&right===t.arg?t:app(left,right),shorter=rewrite?rewrite(joined):shrink(joined,sk);
        if(shorter!==joined)work.push({term:shorter});else values.push(joined);
      }else if(t.type==='app')work.push({term:t,finish:true},{term:t.arg},{term:t.fn});else values.push(t);
    }return values[0];
  }
  function* numeral(value){
    if(value===0)return SK.false;if(value===1)return app(SK.b,SK.i);
    let result=app(SK.w,SK.b);for(let n=2;n<value;n++){yield;result=call('s',SK.b,result);}return result;
  }
  function* numeralBCKW(value){
    if(value===0)return BCKW.false;
    const bits=[];while(value>2){yield;bits.push(value%2);value=Math.floor(value/2);}
    let result=value===1?BCKW.one:BCKW.two;
    while(bits.length){yield;result=call('b',BCKW.two,result);if(bits.pop())result=app(app(BCKW.s,combinators.get('b')),result);}
    return result;
  }
  function* occurs(name,term){
    const pending=[term];
    while(pending.length){yield;const t=pending.pop();if(t.type==='var'&&t.name===name)return true;if(t.type==='app')pending.push(t.fn,t.arg);}
    return false;
  }
  // JavaScript bracket abstraction; the compiler is never a Lambda program.
  // B/C handle linear branches; S/W handle repeated parameters. Avoid eta
  // contraction so even open functions retain their original beta normal form.
  function* abstract(name,term,basis){
    const pending=[{term}],values=[];
    while(pending.length){
      yield;const entry=pending.pop(),t=entry.term;
      if(entry.finish==='s'){const right=values.pop(),left=values.pop();values.push(call('s',left,right));continue;}
      if(entry.finish==='b'){values.push(call('b',t.fn,values.pop()));continue;}
      if(entry.finish==='c'){values.push(call('c',values.pop(),t.arg));continue;}
      if(!(yield* occurs(name,t))){values.push(call('k',t));continue;}
      if(t.type==='var'){values.push(basis==='sk'?call('s',combinators.get('k'),combinators.get('k')):combinators.get('i'));continue;}
      if(basis==='sk'){pending.push({term:t,finish:'s'},{term:t.arg},{term:t.fn});continue;}
      if(t.arg.type==='var'&&t.arg.name===name&&t.fn.type==='app'&&t.fn.arg.type==='var'&&t.fn.arg.name===name&&!(yield* occurs(name,t.fn.fn))){values.push(call('w',t.fn.fn));continue;}
      const left=yield* occurs(name,t.fn),right=yield* occurs(name,t.arg);
      if(!left)pending.push({term:t,finish:'b'},{term:t.arg});
      else if(!right)pending.push({term:t,finish:'c'},{term:t.fn});
      else pending.push({term:t,finish:'s'},{term:t.arg},{term:t.fn});
    }
    return values[0];
  }
  function* compileSteps(term,basis,simplify,recognize=true){
    const pending=[{term}],values=[];
    while(pending.length){
      yield;const entry=pending.pop(),t=entry.term;
      if(entry.finish==='app'){const arg=values.pop();values.push(app(values.pop(),arg));continue;}
      if(entry.finish==='abs'){const body=yield* abstract(t.param,values.pop(),basis);values.push(simplify?yield* simplifySteps(body):body);continue;}
      if(t.type==='var'){values.push({type:'var',name:t.name});continue;}
      if(t.type==='abs'){
        if(recognize&&basis==='bckw'){
          const value=C.churchNumber(t);if(value!==null){values.push(yield* numeralBCKW(value));continue;}
          if(C.equal(t,falseLambda)){values.push(BCKW.false);continue;}
          if(C.equal(t,selfApply)){values.push(call('w',BCKW.i));continue;}
        }
        if(simplify){const value=C.churchNumber(t);if(value!==null){values.push(yield* numeral(value));continue;}if(C.equal(t,falseLambda)){values.push(SK.false);continue;}}
        const known=!recognize||basis==='sk'&&!simplify?null:definitions.find(d=>C.equal(t,d.term));
        if(known)values.push(simplify?SK[known.key]:combinators.get(known.key));
        else pending.push({term:t,finish:'abs'},{term:t.body});
      }else if(t.type==='app')pending.push({term:t,finish:'app'},{term:t.arg},{term:t.fn});
      else throw new C.LambdaError('待编译的表达式结构不合法。');
    }
    return values[0];
  }
  function* compilePipeline(term,basis,simplify,specialize=true){
    if(!specialize){
      // General bracket abstraction only: no numeral/boolean recognition,
      // canonical rewrites, beta simplification or special output recipes.
      const raw=yield* compileSteps(term,basis==='sk'?'sk':'optimized',false,false);
      return basis==='bckw'?yield* lowerBasis(raw,basis,false):raw;
    }
    // Preserve the explicitly unsimplified SK API. UI conversions share the
    // same structural representation, then emit only the requested primitives.
    if(basis==='sk'&&!simplify)return yield* compileSteps(term,basis,false);
    const compiled=yield* compileSteps(term,basis==='bckw'?'bckw':'optimized',false);
    const canonical=yield* simplifySteps(compiled,false,canonicalRewrite);
    return basis==='optimized'?canonical:yield* lowerBasis(canonical,basis);
  }
  function link(term,original,functions,basis,collision){
    const free=C.freeVars(original),occupied=new Set([...free,...functions.map(f=>f.name)]),required=new Set(),pending=[term];
    while(pending.length){const t=pending.pop();if(t.type==='combinator')required.add(t.key);else if(t.type==='app')pending.push(t.fn,t.arg);}
    const names=new Map(),added=[],duplicates=[],ready=[],reused=[];
    const available=basis==='optimized'?definitions:definitions.filter(d=>(basis==='sk'?['s','k']:['b','c','k','w']).includes(d.key)).map(d=>({...d,name:d.key}));
    for(const d of available){
      if(!required.has(d.key))continue;
      const canonical=basis!=='optimized'||d.key==='b'||d.key==='i';
      const direct=collision==='reuse'?functions.find(f=>f.name===d.name&&!free.has(f.name)):null;
      const existing=direct??functions.find(f=>!free.has(f.name)&&(!canonical||f.name===d.name||collision==='rename'&&f.name.startsWith(d.name)&&/^[0-9]+$/.test(f.name.slice(d.name.length)))&&C.equal(f.term,d.term));
      let name=existing?.name??d.name;
      if(!existing){
        if(occupied.has(name)){
          if(collision==='rename'){let index=2n;while(occupied.has(name))name=d.name+(index++);}
          else if(collision!=='replace'||free.has(name)||!functions.some(fn=>fn.name===name)){duplicates.push(name);continue;}
        }
        occupied.add(name);added.push({name,source:d.source,term:d.term});
      }else (direct?reused:ready).push(name);
      names.set(d.key,name);
    }
    if(duplicates.length){const error=new C.LambdaError('重名已跳过：'+duplicates.join('、')+'。已有函数和原算式保持不变，请处理重名后再转换。');error.duplicates=duplicates;throw error;}
    const work=[{term}],values=[];
    while(work.length){const {term:t,finish}=work.pop();if(finish){const arg=values.pop();values.push(C.A(values.pop(),arg));}else if(t.type==='app')work.push({term:t,finish:true},{term:t.arg},{term:t.fn});else values.push(C.V(t.type==='combinator'?names.get(t.key):t.name));}
    const compiled=values[0];return {term:compiled,source:C.format(compiled),definitions:added,used:[...names.values()],ready,reused};
  }
  async function compileTerm(term,{functions=[],signal,onProgress,basis='optimized',simplify=false,specialize=true,collision='skip'}={}){
    if(!['skip','replace','rename','reuse'].includes(collision))throw new C.LambdaError('函数重名处理方式不合法。');
    if(!['optimized','sk','bckw'].includes(basis))throw new C.LambdaError('不支持的组合子类型。');
    if(simplify&&!['sk','bckw'].includes(basis))throw new C.LambdaError('结构简化用于 SK 或 BCKW 转换。');
    if(typeof specialize!=='boolean')throw new C.LambdaError('特殊化简选项必须是开关。');
    const iterator=compilePipeline(term,basis,simplify&&basis==='sk',specialize);let next,operations=0,start=Date.now();
    do{
      if(signal?.aborted){const error=new Error('编译已取消。');error.name='AbortError';throw error;}
      next=iterator.next();operations++;
      if(operations%256===0&&Date.now()-start>=8){onProgress?.(operations);await new Promise(resolve=>setTimeout(resolve,0));start=Date.now();}
    }while(!next.done);
    return link(next.value,term,functions,basis,collision);
  }
  const API={compileTerm};root.LambdaCombinatorCompiler=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
