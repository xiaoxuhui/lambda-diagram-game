(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');

  function normalize(term,{signal,onProgress}={}){
    const stack=[{kind:'quote'}],names=C.freeVars(term),normalForms=new WeakMap();
    let job={term,environment:null},value,nextName=0,steps=0;
    let lastCall=null;
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
          if(value.term){
            const continuation=stack.at(-1);
            if(lastCall?.closure===value&&lastCall.argument===frame.argument&&lastCall.continuation===continuation)
              throw new C.LambdaError('检测到重复求值循环，求值已停止。');
            lastCall={closure:value,argument:frame.argument,continuation};
            steps++;
            // A tail call proceeds directly, without retaining a thunk for its result.
            job={term:value.term.body,environment:{name:value.term.param,argument:frame.argument,parent:value.environment}};
          }else deliver({fn:value,arg:frame.argument});
          break;
        case 'quote': {
          const normal=normalForms.get(value);
          if(normal){deliver(normal);break;}
          stack.push({kind:'rememberForm',source:value});
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
      function batch(){
        try{
          if(signal?.aborted){reject(new Error('求值已取消。'));return;}
          const start=performance.now();
          do{
            for(let i=0;i<256&&(job||stack.length);i++)visit();
            if(!job&&!stack.length){resolve(value);return;}
          }while(performance.now()-start<8);
          onProgress?.(steps);
          setTimeout(batch,12);
        }catch(error){reject(error);}
      }
      batch();
    });
  }
  const API={normalize};
  root.LambdaLazyEval=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
