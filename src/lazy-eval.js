(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  const Guard=root.LambdaRunGuard||require('./run-guard.js');

  function normalize(term,{signal,onProgress,growthWindowMs=Guard.DEFAULT_MS,waitWindowMs=0,onPause}={}){
    const stack=[{kind:'quote'}],names=C.freeVars(term),normalForms=new WeakMap();
    let job={term,environment:null},value,nextName=0,steps=0;
    const guard=Guard.create({windowMs:growthWindowMs,initial:stack.length});
    const waitGuard=Guard.create({windowMs:waitWindowMs,requireGrowth:false});
    // Track unfinished demands, including calls whose result is still being
    // normalized under a neutral head or lambda. Repeating one is productive
    // growth as well as a possible black hole; neither has a finite normal form.
    const activeCalls=new WeakMap();
    function enter(call){
      let argumentsFor=activeCalls.get(call.closure);
      if(!argumentsFor){argumentsFor=new WeakSet();activeCalls.set(call.closure,argumentsFor);}
      if(argumentsFor.has(call.argument))throw new C.LambdaError('检测到重复求值循环或递归展开无限增长，求值已停止。');
      argumentsFor.add(call.argument);
    }
    function leave(call){activeCalls.get(call.closure).delete(call.argument);}
    function fresh(){
      let name;
      do{name='v'+nextName++;}while(names.has(name));
      return name;
    }
    function deliver(result){
      value=result;job=null;
    }
    function bound(name,environment){
      for(let binding=environment;binding;binding=binding.parent){
        if(binding.name===name)return binding.argument;
      }
      return null;
    }
    function suspend(term,environment){
      // Passing an existing variable forward shares its suspended computation.
      return (term.type==='var'&&bound(term.name,environment))||{term,environment,value:null};
    }
    function force(source){
      if(source.value){deliver(source.value);return;}
      stack.push({kind:'remember',source});
      job={term:source.term,environment:source.environment};
    }
    function visit(){
      if(job){
        const {term,environment}=job;
        if(term.type==='abs'){deliver({term,environment});return;}
        if(term.type==='app'){
          stack.push({kind:'apply',argument:suspend(term.arg,environment)});
          job={term:term.fn,environment};return;
        }
        const argument=bound(term.name,environment);
        if(argument)force(argument);else deliver({name:term.name});
        return;
      }
      const frame=stack.pop();
      switch(frame.kind){
        case 'remember':frame.source.value=value;frame.source.term=null;frame.source.environment=null;break;
        case 'apply':
          // Provenance belongs to normalization of the result, not to a later
          // application of a returned function (which may discard its body).
          while(value.origin)value=value.target;
          if(value.term){
            const call={closure:value,argument:frame.argument};enter(call);
            stack.push({kind:'finishCall',call});
            steps++;
            job={term:value.term.body,environment:{name:value.term.param,argument:frame.argument,parent:value.environment}};
          }else deliver({fn:value,arg:frame.argument});
          break;
        case 'finishCall':
          leave(frame.call);deliver({origin:frame.call,target:value});break;
        case 'leaveOrigin':leave(frame.call);break;
        case 'quote': {
          const normal=normalForms.get(value);
          if(normal){deliver(normal);break;}
          stack.push({kind:'rememberForm',source:value});
          if(value.origin){
            enter(value.origin);stack.push({kind:'leaveOrigin',call:value.origin},{kind:'quote'});
            deliver(value.target);break;
          }
          if(value.term){
            const name=fresh(),argument={value:{name}};
            stack.push({kind:'abstract',name},{kind:'quote'});
            job={term:value.term.body,environment:{name:value.term.param,argument,parent:value.environment}};
          }else if(value.fn){
            stack.push({kind:'quoteArg',arg:value.arg},{kind:'quote'});
            deliver(value.fn);
          }else deliver(C.V(value.name));
          break;
        }
        case 'rememberForm':normalForms.set(frame.source,value);break;
        case 'quoteArg':
          stack.push({kind:'buildApp',fn:value},{kind:'quote'});
          force(frame.arg);
          break;
        case 'abstract':deliver(C.L(frame.name,value));break;
        case 'buildApp':deliver(C.A(frame.fn,value));break;
      }
    }
    return new Promise((resolve,reject)=>{
      let settled=false;
      function finish(error,result){if(settled)return;settled=true;signal?.removeEventListener('abort',abort);if(error)reject(error);else resolve(result);}
      function abort(){finish(new Error('求值已取消。'));}
      signal?.addEventListener('abort',abort,{once:true});
      function batch(){
        if(settled)return;
        try{
          if(signal?.aborted){abort();return;}
          const start=performance.now();
          do{
            for(let i=0;i<256&&(job||stack.length);i++)visit();
            if(!job&&!stack.length){finish(null,value);return;}
            const waiting=waitGuard.check(stack.length);
            if(waiting||guard.check(stack.length)){
              const message=waiting?Guard.waitingMessage:Guard.message;
              if(!onPause){const error=new C.LambdaError(message);error.name=waiting?'WaitPauseError':'GrowthPauseError';finish(error);return;}
              Promise.resolve(onPause({steps,message,reason:waiting?'wait':'growth'})).then(proceed=>{
                if(settled)return;
                if(!proceed){abort();return;}
                guard.reset(stack.length);waitGuard.reset(stack.length);setTimeout(batch,12);
              },error=>finish(error));return;
            }
          }while(performance.now()-start<8);
          onProgress?.(steps);
          setTimeout(batch,12);
        }catch(error){finish(error);}
      }
      batch();
    });
  }
  const API={normalize};
  root.LambdaLazyEval=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
