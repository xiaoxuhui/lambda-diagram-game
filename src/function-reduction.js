(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  function create(functions=[]){
    const definitions=new Map(functions.map(fn=>[fn.name,fn.term])),available=new WeakMap();
    const bound=(name,scope)=>{for(let s=scope;s;s=s.parent)if(s.name===name)return true;return false;};
    const canUnfold=term=>{
      if(!available.has(term))available.set(term,[...C.freeVars(term)].some(name=>definitions.has(name)));
      return available.get(term);
    };
    function find(term,strategy='normal',direction='left'){
      if(!C.STRATEGIES.includes(strategy)||!C.DIRECTIONS.includes(direction))throw new C.LambdaError('归约顺序或方向不合法。');
      if(!definitions.size)return C.findRedex(term,[],strategy,direction);
      const first=direction==='right'?'arg':'fn',second=first==='fn'?'arg':'fn',pending=[{term,scope:null,route:null}];
      const pathOf=route=>{const path=[];for(let r=route;r;r=r.parent)path.push(r.part);return path.reverse();};
      while(pending.length){
        const entry=pending.pop(),t=entry.term;
        if(entry.finish)return {term:t,path:pathOf(entry.route)};
        if(!C.hasRedex(t)&&!canUnfold(t))continue;
        if(t.type==='var'){
          if(definitions.has(t.name)&&!bound(t.name,entry.scope))return {kind:'unfold',term:t,path:pathOf(entry.route)};
        }else if(t.type==='abs')pending.push({term:t.body,scope:{name:t.param,parent:entry.scope},route:{part:'body',parent:entry.route}});
        else{
          if(t.fn.type==='abs'){
            if(strategy==='normal')return {term:t,path:pathOf(entry.route)};
            pending.push({...entry,finish:true});
          }
          pending.push({term:t[second],scope:entry.scope,route:{part:second,parent:entry.route}},
            {term:t[first],scope:entry.scope,route:{part:first,parent:entry.route}});
        }
      }
      return null;
    }
    function unfoldAt(term,path){
      if(!Array.isArray(path))return null;
      const parents=[],used=new Set(C.freeVars(term));let selected=term;
      for(const part of path){
        if(!selected||!((selected.type==='abs'&&part==='body')||(selected.type==='app'&&['fn','arg'].includes(part))))return null;
        if(selected.type==='abs')used.add(selected.param);
        parents.push(selected);selected=selected[part];
      }
      if(selected?.type!=='var'||!definitions.has(selected.name)||parents.some(p=>p.type==='abs'&&p.param===selected.name))return null;
      const replacement=definitions.get(selected.name);for(const name of C.freeVars(replacement))used.add(name);
      let placeholder='展开占位';while(used.has(placeholder))placeholder+="'";
      let context=C.V(placeholder);
      for(let i=parents.length-1;i>=0;i--){const p=parents[i],part=path[i];context=part==='body'?C.L(p.param,context):part==='fn'?C.A(context,p.arg):C.A(p.fn,context);}
      // Substitute the single fresh placeholder so enclosing binders cannot
      // capture any free variables belonging to the external definition.
      return {kind:'unfold',term:C.substitute(context,placeholder,replacement),path:path.slice(),before:selected,replacement,param:selected.name,argument:replacement};
    }
    function step(term,strategy,direction){const selected=find(term,strategy,direction);return !selected?null:selected.kind==='unfold'?unfoldAt(term,selected.path):C.stepAt(term,selected.path);}
    return {find,step,unfoldAt};
  }
  function capture(term,functions){
    const L=root.LambdaLibrary||require('./library.js');
    const registry=new Map(functions.map(fn=>[fn.name,fn])),seen=new Set(),pending=[...C.freeVars(term)],result=[];
    while(pending.length){
      const name=pending.pop();if(seen.has(name))continue;seen.add(name);const fn=registry.get(name);if(!fn)continue;
      let body=fn.body;
      if(!body&&typeof fn.source==='string')try{body=C.parse(fn.source);}catch{}
      const term=fn.named?fn.term:body&&C.equal(L.expand(body,functions),fn.term)?body:fn.term;
      result.push({name,term});pending.push(...C.freeVars(term));
    }
    return result;
  }
  function prepare(term,functions=[],dataTerms=[]){
    const definitions=capture(term,functions),occupied=new Set(functions.map(fn=>fn.name)),seen=new WeakSet(),pending=[term,...definitions.map(fn=>fn.term)];
    while(pending.length){const node=pending.pop();if(seen.has(node))continue;seen.add(node);
      if(node.type==='var')occupied.add(node.name);else if(node.type==='abs'){occupied.add(node.param);pending.push(node.body);}else pending.push(node.fn,node.arg);
    }
    const hints=new WeakMap(dataTerms.map(entry=>[entry.term,entry.kind])),numbers=new Map(),rewritten=new WeakMap(),virtual=[];let listIndex=0;
    function reserve(base){let name=base,index=2;while(occupied.has(name))name=base+'_'+index++;occupied.add(name);return name;}
    function isList(node){
      if(node.type!=='abs'||node.body.type!=='abs'||node.param===node.body.param)return false;
      const cons=node.param,nil=node.body.param;let body=node.body.body;
      while(body.type==='app'&&body.fn.type==='app'&&body.fn.fn.type==='var'&&body.fn.fn.name===cons)body=body.arg;
      return body.type==='var'&&body.name===nil;
    }
    function walk(root){
      const work=[{node:root}];
      while(work.length){
        const entry=work.pop(),node=entry.node;if(rewritten.has(node))continue;
        if(!entry.finish){
          const hint=hints.get(node),number=hint==='list'?null:C.churchNumber(node);
          if(number!==null){
            if(!numbers.has(number)){const name=reserve('n'+number);numbers.set(number,name);virtual.push({name,term:node});}
            rewritten.set(node,C.V(numbers.get(number)));continue;
          }
          let deferred=null;
          if(hint==='list'||isList(node)){
            const name=reserve('list'+(++listIndex)),parameters=[...C.freeVars(node)],definition={name,term:null};
            virtual.push(definition);deferred={definition,parameters,reference:parameters.reduce((value,name)=>C.A(value,C.V(name)),C.V(name))};
          }
          if(node.type==='var'){rewritten.set(node,node);continue;}
          work.push({node,finish:true,deferred});
          if(node.type==='abs')work.push({node:node.body});else work.push({node:node.arg},{node:node.fn});
        }else{
          let rebuilt;
          if(node.type==='abs'){const body=rewritten.get(node.body);rebuilt=body===node.body?node:C.L(node.param,body);}
          else{const fn=rewritten.get(node.fn),arg=rewritten.get(node.arg);rebuilt=fn===node.fn&&arg===node.arg?node:C.A(fn,arg);}
          if(entry.deferred){const {definition,parameters,reference}=entry.deferred;definition.term=parameters.reduceRight((value,name)=>C.L(name,value),rebuilt);rewritten.set(node,reference);}
          else rewritten.set(node,rebuilt);
        }
      }return rewritten.get(root);
    }
    const prepared=walk(term),named=definitions.map(fn=>({name:fn.name,term:walk(fn.term)}));
    return {term:prepared,definitions:[...named,...virtual]};
  }
  function expand(term,definitions=[]){
    const L=root.LambdaLibrary||require('./library.js'),names=new Set(definitions.map(fn=>fn.name));
    for(let i=0;i<definitions.length&&[...C.freeVars(term)].some(name=>names.has(name));i++)term=L.expand(term,definitions);
    return term;
  }
  const API={create,capture,prepare,expand};root.LambdaFunctionReduction=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
