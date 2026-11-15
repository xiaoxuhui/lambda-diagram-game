(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');

  // A suspended argument shares its value with every reference to its binder.
  function normalize(term,{signal,onProgress}={}){
    const thunk=(term,environment)=>({term,environment,value:null});
    const stack=[],names=C.freeVars(term);
    let job={kind:'normalize',thunk:thunk(term,null)},value,nextName=0,steps=0;
    function fresh(){
      let name;
      do{name='v'+nextName++;}while(names.has(name));
      return name;
    }
    function force(source){
      job={kind:'force',thunk:source};
    }
    function deliver(result){
      value=result;job=null;
    }
    function visit(){
      if(job){
        const source=job.thunk;
        if(job.kind==='normalize'){stack.push({kind:'quote'});force(source);return;}
        if(source.value){deliver(source.value);return;}
        const {term,environment}=source;
        stack.push({kind:'remember',source});
        if(term.type==='abs'){deliver({term,environment});return;}
        if(term.type==='app'){
          stack.push({kind:'apply',argument:thunk(term.arg,environment)});
          force(thunk(term.fn,environment));return;
        }
        let binding=environment;
        while(binding&&binding.name!==term.name)binding=binding.parent;
        if(binding)force(binding.argument);else deliver({name:term.name});
        return;
      }
      const frame=stack.pop();
      switch(frame.kind){
        case 'remember':frame.source.value=value;frame.source.term=null;frame.source.environment=null;break;
        case 'apply':
          if(value.term){
            steps++;
            force(thunk(value.term.body,{name:value.term.param,argument:frame.argument,parent:value.environment}));
          }else deliver({fn:value,arg:frame.argument});
          break;
        case 'quote':
          if(value.term){
            const name=fresh(),argument={value:{name}};
            stack.push({kind:'abstract',name});
            job={kind:'normalize',thunk:thunk(value.term.body,{name:value.term.param,argument,parent:value.environment})};
          }else if(value.fn){
            stack.push({kind:'quoteArg',arg:value.arg},{kind:'quote'});
            deliver(value.fn);
          }else deliver(C.V(value.name));
          break;
        case 'quoteArg':
          stack.push({kind:'buildApp',fn:value});
          job={kind:'normalize',thunk:frame.arg};
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
          setTimeout(batch,0);
        }catch(error){reject(error);}
      }
      batch();
    });
  }
  const API={normalize};
  root.LambdaLazyEval=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
