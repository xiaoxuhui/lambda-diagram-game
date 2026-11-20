(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  const definitions=[
    ['i','id','λx.x'],['k','true','λa b.a'],['b','mul','λf g x.f (g x)'],
    ['c','c','λf x y.f y x'],['s','s','λf g x.f x (g x)'],['w','w','λf x.f x x']
  ].map(([key,name,source])=>({key,name,source:C.explicitLambdas(source),term:C.parse(source)}));
  const combinators=new Map(definitions.map(d=>[d.key,{type:'combinator',key:d.key}]));
  const app=(fn,arg)=>({type:'app',fn,arg}),call=(key,...args)=>args.reduce(app,combinators.get(key));
  function* occurs(name,term){
    const pending=[term];
    while(pending.length){yield;const t=pending.pop();if(t.type==='var'&&t.name===name)return true;if(t.type==='app')pending.push(t.fn,t.arg);}
    return false;
  }
  // JavaScript bracket abstraction; the compiler is never a Lambda program.
  // B/C handle linear branches; S/W handle repeated parameters. Avoid eta
  // contraction so even open functions retain their original beta normal form.
  function* abstract(name,term){
    const pending=[{term}],values=[];
    while(pending.length){
      yield;const entry=pending.pop(),t=entry.term;
      if(entry.finish==='s'){const right=values.pop(),left=values.pop();values.push(call('s',left,right));continue;}
      if(entry.finish==='b'){values.push(call('b',t.fn,values.pop()));continue;}
      if(entry.finish==='c'){values.push(call('c',values.pop(),t.arg));continue;}
      if(!(yield* occurs(name,t))){values.push(call('k',t));continue;}
      if(t.type==='var'){values.push(combinators.get('i'));continue;}
      if(t.arg.type==='var'&&t.arg.name===name&&t.fn.type==='app'&&t.fn.arg.type==='var'&&t.fn.arg.name===name&&!(yield* occurs(name,t.fn.fn))){values.push(call('w',t.fn.fn));continue;}
      const left=yield* occurs(name,t.fn),right=yield* occurs(name,t.arg);
      if(!left)pending.push({term:t,finish:'b'},{term:t.arg});
      else if(!right)pending.push({term:t,finish:'c'},{term:t.fn});
      else pending.push({term:t,finish:'s'},{term:t.arg},{term:t.fn});
    }
    return values[0];
  }
  function* compileSteps(term){
    const pending=[{term}],values=[];
    while(pending.length){
      yield;const entry=pending.pop(),t=entry.term;
      if(entry.finish==='app'){const arg=values.pop();values.push(app(values.pop(),arg));continue;}
      if(entry.finish==='abs'){values.push(yield* abstract(t.param,values.pop()));continue;}
      if(t.type==='var'){values.push({type:'var',name:t.name});continue;}
      if(t.type==='abs'){
        const known=definitions.find(d=>C.equal(t,d.term));
        if(known)values.push(combinators.get(known.key));
        else pending.push({term:t,finish:'abs'},{term:t.body});
      }else if(t.type==='app')pending.push({term:t,finish:'app'},{term:t.arg},{term:t.fn});
      else throw new C.LambdaError('待编译的表达式结构不合法。');
    }
    return values[0];
  }
  function link(term,original,functions){
    const free=C.freeVars(original),occupied=new Set([...free,...functions.map(f=>f.name)]),required=new Set(),pending=[term];
    while(pending.length){const t=pending.pop();if(t.type==='combinator')required.add(t.key);else if(t.type==='app')pending.push(t.fn,t.arg);}
    const names=new Map(),added=[];
    for(const d of definitions){
      if(!required.has(d.key))continue;
      const existing=functions.find(f=>!free.has(f.name)&&C.equal(f.term,d.term));
      let name=existing?.name??d.name,index=2;
      if(!existing){while(occupied.has(name))name=d.name+index++;occupied.add(name);added.push({name,source:d.source,term:d.term});}
      names.set(d.key,name);
    }
    const work=[{term}],values=[];
    while(work.length){const {term:t,finish}=work.pop();if(finish){const arg=values.pop();values.push(C.A(values.pop(),arg));}else if(t.type==='app')work.push({term:t,finish:true},{term:t.arg},{term:t.fn});else values.push(C.V(t.type==='combinator'?names.get(t.key):t.name));}
    const compiled=values[0];return {term:compiled,source:C.format(compiled),definitions:added,used:[...names.values()]};
  }
  async function compileTerm(term,{functions=[],signal,onProgress}={}){
    const iterator=compileSteps(term);let next,operations=0,start=Date.now();
    do{
      if(signal?.aborted){const error=new Error('编译已取消。');error.name='AbortError';throw error;}
      next=iterator.next();operations++;
      if(operations%256===0&&Date.now()-start>=8){onProgress?.(operations);await new Promise(resolve=>setTimeout(resolve,0));start=Date.now();}
    }while(!next.done);
    return link(next.value,term,functions);
  }
  const API={compileTerm};root.LambdaCombinatorCompiler=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
