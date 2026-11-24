(function(root) {
  'use strict';
  const C=root.LambdaCore || require('./core.js');
  const LIMITS={count:Infinity,nodes:Infinity,nameChars:Infinity};
  const validName=C.validName;
  const COLLISIONS=['skip','replace','rename','reuse'];
  const namedSources=new WeakMap();
  const generatedBindings=new WeakSet();
  function helperBinding(name,body,value){const term=C.A(C.L(name,body),value);generatedBindings.add(term);return term;}
  function availableName(base,functions=[],reserved=[]){const used=new Set([...functions.map(fn=>fn.name),...reserved]);let index=2n,name=base;while(used.has(name)){name=base+index;index++;}return name;}
  function names(t,out=new Set()) {
    if(t.type==='var')out.add(t.name);
    else if(t.type==='abs'){out.add(t.param);names(t.body,out);}
    else{names(t.fn,out);names(t.arg,out);}return out;
  }
  function validate(functions) {
    if(!Array.isArray(functions))throw new C.LambdaError('函数库格式不合法。');
    const seen=new Set();let nodes=0,nameChars=0;
    for(const fn of functions) {
      if(fn.named!==undefined&&typeof fn.named!=='boolean')throw new C.LambdaError('命名函数定义标记不合法。');
      if(fn.named){
        if(typeof fn.source!=='string')throw new C.LambdaError('命名函数缺少原始定义。');
        if(namedSources.get(fn.term)!==fn.source){if(C.format(fn.term)!==C.format(C.parse(fn.source,Infinity)))throw new C.LambdaError('函数原文与表达式不一致：'+fn.name);namedSources.set(fn.term,fn.source);}
        if(fn.body&&C.format(fn.body)!==C.format(fn.term))throw new C.LambdaError('函数体与原始定义不一致：'+fn.name);
      }
      if(fn.body!==undefined)C.inspect(fn.body);
      if(fn.source!==undefined&&typeof fn.source!=='string')throw new C.LambdaError('函数原始定义需为文本。');
      if(fn.encodings!==undefined&&(!Array.isArray(fn.encodings)||fn.encodings.some(name=>!C.validName(name))))throw new C.LambdaError('函数编码标记不合法。');
      if(fn.sourceFree!==undefined&&(!Array.isArray(fn.sourceFree)||fn.sourceFree.some(name=>!C.validName(name))))throw new C.LambdaError('函数原文变量标记不合法。');
      if(!validName(fn.name))throw new C.LambdaError('函数名不能为空，也不能含空白或 λ、点、括号等语法符号；不限制首字符。');
      if(seen.has(fn.name))throw new C.LambdaError(`函数「${fn.name}」已存在，请换一个名字。`);
      seen.add(fn.name);nodes+=C.inspect(fn.term).nodes;
      const stack=[fn.term];while(stack.length){const t=stack.pop();if(t.type==='var')nameChars+=t.name.length;else if(t.type==='abs'){nameChars+=t.param.length;stack.push(t.body);}else stack.push(t.fn,t.arg);}
    }
    return functions;
  }
  function expand(term,functions,{preserve=[]}={}) {
    const registry=new Map(functions.map(f=>[f.name,f])),free=C.freeVars(term);
    const protectedNames=new Set(preserve);
    const used=names(term);for(const f of functions)names(f.term,used);
    const replacements=[];let next=0,result=term;
    for(const name of free) {
      if(!registry.has(name)||protectedNames.has(name))continue;
      let placeholder;do{placeholder=`lambdaMacro${++next}`;}while(used.has(placeholder));used.add(placeholder);
      result=C.substitute(result,name,C.V(placeholder));replacements.push([placeholder,functionValue(registry.get(name),functions)]);
    }
    for(const [placeholder,definition] of replacements)result=C.substitute(result,placeholder,definition);
    C.inspect(result);return result;
  }
  function functionValue(fn,functions){
    if(!fn.named)return fn.term;
    const registry=new Map(functions.map(entry=>[entry.name,entry])),ordered=[],seen=new Set(),active=new Set();
    function visit(entry){if(seen.has(entry.name))return;if(active.has(entry.name))throw new C.LambdaError('函数定义存在循环引用：'+entry.name+'；递归请使用显式不动点组合子。');active.add(entry.name);if(entry.named)for(const name of C.freeVars(entry.term)){const dependency=registry.get(name);if(dependency)visit(dependency);}active.delete(entry.name);seen.add(entry.name);ordered.push(entry);}
    visit(fn);const dependencies=ordered.filter(entry=>entry!==fn),used=new Set(),external=new Set();
    const pending=ordered.map(entry=>entry.term);while(pending.length){const node=pending.pop();if(node.type==='var')used.add(node.name);else if(node.type==='abs'){used.add(node.param);pending.push(node.body);}else pending.push(node.fn,node.arg);}
    for(const entry of ordered)for(const name of C.freeVars(entry.term))if(!entry.named||!registry.has(name))external.add(name);
    const locals=new Map(),fresh=base=>{let name=base;do{name+="'";}while(used.has(name)||external.has(name));used.add(name);return name;};
    for(const entry of dependencies)if(external.has(entry.name))locals.set(entry.name,fresh(entry.name));
    const protect=new Set([...dependencies.map(entry=>entry.name),...external]),parameters=[];let body=fn.term;
    while(body.type==='abs'){let name=body.param,next=body.body;if(protect.has(name)){const renamed=fresh(name);next=C.substitute(next,name,C.V(renamed));name=renamed;}parameters.push(name);body=next;}
    const local=term=>{for(const [name,renamed]of locals)term=C.substitute(term,name,C.V(renamed));return term;};body=local(body);
    for(const entry of dependencies.reverse())body=helperBinding(locals.get(entry.name)??entry.name,body,entry.named?local(entry.term):entry.term);
    for(const name of parameters.reverse())body=C.L(name,body);return body;
  }
  function importExact(functions,definitions,selected,collision){
    const registry=new Map(),next=functions.slice(),added=[],ready=[],replaced=[],bindings=Object.create(null);
    for(const definition of definitions){if(!validName(definition.name)||registry.has(definition.name)||typeof definition.source!=='string')throw new C.LambdaError('示例函数定义不完整或重名。');registry.set(definition.name,{...definition,term:C.parse(definition.source,Infinity)});}
    const wanted=new Set(),active=new Set();function visit(name){if(wanted.has(name))return;if(active.has(name))throw new C.LambdaError('示例函数循环引用：'+name);const entry=registry.get(name);if(!entry)throw new C.LambdaError('示例缺少函数：'+name);active.add(name);for(const dependency of C.freeVars(entry.term))if(registry.has(dependency))visit(dependency);active.delete(name);wanted.add(name);}
    for(const name of selected??registry.keys())visit(name);
    const conflicts=[...wanted].filter(name=>functions.some(fn=>fn.name===name&&fn.source!==registry.get(name).source));
    if(conflicts.length&&collision!=='replace'){const error=new C.LambdaError('示例定义不一致：'+conflicts.join('、')+'。未更改函数库；选择“重名替换”可按示例原文导入。');error.conflicts=conflicts;throw error;}
    for(const name of wanted){const entry=registry.get(name),existing=next.find(fn=>fn.name===name),definition={name,source:entry.source,term:entry.term,body:entry.term,named:true,sourceFree:[...C.freeVars(entry.term)]};bindings[name]=name;if(existing){next[next.indexOf(existing)]=definition;(existing.source===entry.source?ready:replaced).push(name);}else{next.push(definition);added.push(name);}}
    validate(next);return {functions:next,added,ready,replaced,skipped:[],renamed:[],reused:[],inlined:[],bindings,exact:true,verified:[...wanted]};
  }
  function add(functions,name,source,maxChars=C.LIMITS.chars,numberEncoding='church',precision=6,dataEncodings=null,prepared=null) {
    name=name.trim();
    if(!validName(name))throw new C.LambdaError('函数名不能为空，也不能含空白或 λ、点、括号等语法符号；不限制首字符。');
    if(functions.some(f=>f.name===name))throw new C.LambdaError(`函数「${name}」已存在，请换一个名字。`);
    const compiled=prepared??(dataEncodings!==null?(root.LambdaDataEncoding||require('./data-encoding.js')).parse(source,dataEncodings,maxChars,numberEncoding):null);
    const parsed=compiled?compiled.term:numberEncoding==='decimal'?C.parseInput(source,maxChars):C.parse(source,maxChars);
    if(C.freeVars(parsed).has(name))throw new C.LambdaError('定义不能直接引用自身。递归请使用显式不动点组合子。');
    const term=expand(parsed,functions);
    const result=[...functions,{name,source,term,body:parsed,...(compiled?{encodings:[...new Set([...compiled.encodings,...encodingsFor(parsed,functions)])],sourceFree:[...C.freeVars(parsed)]}:{})}];validate(result);return result;
  }
  const remove=(functions,name)=>functions.filter(f=>f.name!==name);
  function update(functions,originalName,name,source,numberEncoding='church',precision=6,dataEncodings=null,prepared=null) {
    const original=functions.find(fn=>fn.name===originalName);
    if(!original)throw new C.LambdaError('要编辑的函数已不存在。');
    const others=remove(functions,originalName);
    let replacement;
    if(typeof original.source==='string'&&source===original.source){
      name=name.trim();replacement={...original,name,source,term:original.term};validate([...others,replacement]);
      const sourceNames=original.sourceFree??[...C.freeVars(C.parse(source,Infinity,()=>C.parse('0'),{suffixes:true}))];
      if(sourceNames.includes(name))throw new C.LambdaError('定义不能直接引用自身。递归请使用显式不动点组合子。');
    }else replacement=add(others,name,source,Infinity,numberEncoding,precision,dataEncodings,prepared).at(-1);
    return functions.map(fn=>fn.name===originalName?replacement:fn);
  }
  function encodingsFor(term,functions){const names=C.freeVars(term);return [...new Set(functions.filter(fn=>names.has(fn.name)).flatMap(fn=>fn.encodings??[]))];}
  // Capture lexical helper declarations without executing or duplicating them.
  // Free references to surrounding data become explicit closure parameters.
  function captureHelpers(term,patterns,functions=[],{declaredOnly=false}={}){
    const registry=new Map(),used=new Set(),definitions=[];
    for(const entry of patterns){const values=registry.get(entry.name)??[];values.push(entry.term);registry.set(entry.name,values);}
    const pending=[term,...functions.map(entry=>entry.term)],seen=new WeakSet();let hasHelpers=false;
    while(pending.length){const node=pending.pop();if(seen.has(node))continue;seen.add(node);if(node.type==='var')used.add(node.name);else if(node.type==='abs'){used.add(node.param);pending.push(node.body);}else{
      const candidates=node.fn.type==='abs'?registry.get(node.fn.param):null;
      if(declaredOnly?generatedBindings.has(node):candidates?.some(value=>C.equal(value,node.arg)))hasHelpers=true;
      pending.push(node.fn,node.arg);
    }}
    if(!hasHelpers)return {term,definitions:functions};
    for(const entry of functions)used.add(entry.name);
    const reserve=base=>{let name=base;while(used.has(name))name+="'";used.add(name);return name;};
    const isBound=(name,bound)=>{for(let scope=bound;scope;scope=scope.parent)if(scope.name===name)return true;return false;};
    function walk(root){
      const work=[{node:root,environment:new Map(),bound:null}],values=[];
      while(work.length){
        const frame=work.pop(),{node,environment,bound}=frame;
        if(frame.stage==='abs'){
          const body=values.pop();values.push(frame.param===node.param&&body===node.body?node:C.L(frame.param,body));continue;
        }
        if(frame.stage==='app'){
          const arg=values.pop(),fn=values.pop();values.push(fn===node.fn&&arg===node.arg?node:C.A(fn,arg));continue;
        }
        if(frame.stage==='helper'){
          const value=values.pop(),parameters=[...C.freeVars(value)].filter(name=>isBound(name,bound)),name=reserve(node.fn.param);
          definitions.push({name,term:parameters.reduceRight((body,param)=>C.L(param,body),value)});
          const reference=parameters.reduce((body,param)=>C.A(body,C.V(param)),C.V(name)),scope=new Map(environment);scope.set(node.fn.param,reference);
          work.push({node:node.fn.body,environment:scope,bound});continue;
        }
        if(node.type==='var'){
          const value=environment.get(node.name);values.push(!value||value.type==='var'&&value.name===node.name?node:value);continue;
        }
        if(node.type==='abs'){
          const scope=new Map(environment);scope.delete(node.param);let param=node.param;
          if([...scope.values()].some(value=>C.freeVars(value).has(param)))param=reserve(param);
          if(param!==node.param)scope.set(node.param,C.V(param));
          work.push({node,stage:'abs',param},{node:node.body,environment:scope,bound:{name:param,parent:bound}});continue;
        }
        const candidates=node.fn.type==='abs'?registry.get(node.fn.param):null;
        if(declaredOnly?generatedBindings.has(node):candidates?.some(value=>C.equal(value,node.arg)))work.push({...frame,stage:'helper'},{node:node.arg,environment,bound});
        else work.push({node,stage:'app'},{node:node.arg,environment,bound},{node:node.fn,environment,bound});
      }
      return values[0];
    }
    const prepared=walk(term),named=functions.map(entry=>({name:entry.name,term:walk(entry.term)}));
    return {term:prepared,definitions:[...named,...definitions]};
  }
  function closeHelpers(term,definitions=[]){
    if(!definitions.length)return term;
    const names=new Set(definitions.map(entry=>entry.name));
    function occurrences(term,name){
      const pending=[term];let count=0;
      while(pending.length&&count<2){const node=pending.pop();if(node.type==='var'){if(node.name===name)count++;}else if(node.type==='abs'){if(node.param!==name)pending.push(node.body);}else pending.push(node.fn,node.arg);}
      return count;
    }
    function walk(root){
      const work=[{node:root}],values=[];
      while(work.length){
        const {node,finish}=work.pop();
        if(node.type==='var'){values.push(node);continue;}
        if(!finish){work.push({node,finish:true});if(node.type==='abs')work.push({node:node.body});else work.push({node:node.arg},{node:node.fn});continue;}
        if(node.type==='abs'){const body=values.pop();values.push(body===node.body?node:C.L(node.param,body));continue;}
        const arg=values.pop(),fn=values.pop();
        if(fn.type==='abs'&&names.has(fn.param)){
          const count=occurrences(fn.body,fn.param);
          if(!count){values.push(fn.body);continue;}
          if(count===1){values.push(C.substitute(fn.body,fn.param,arg));continue;}
        }
        values.push(fn===node.fn&&arg===node.arg?node:C.A(fn,arg));
      }
      return values[0];
    }
    return walk(definitions.reduceRight((body,entry)=>C.A(C.L(entry.name,body),entry.term),term));
  }
  // Resolve declared helpers where they were written. Hoisting them around
  // the whole call would move actual data underneath new lambda binders.
  function linkHelpersInPlace(term,patterns=[],{declaredOnly=false}={}){
    const registry=new Map();for(const entry of patterns){const values=registry.get(entry.name)??[];values.push(entry.term);registry.set(entry.name,values);}
    const occurrences=(term,name)=>{const work=[term];let count=0;while(work.length&&count<2){const node=work.pop();if(node.type==='var'){if(node.name===name)count++;}else if(node.type==='abs'){if(node.param!==name)work.push(node.body);}else work.push(node.fn,node.arg);}return count;};
    const work=[{node:term}],values=[];
    while(work.length){
      const {node,finish}=work.pop();
      if(node.type==='var'){values.push(node);continue;}
      if(!finish){work.push({node,finish:true});if(node.type==='abs')work.push({node:node.body});else work.push({node:node.arg},{node:node.fn});continue;}
      if(node.type==='abs'){const body=values.pop();values.push(body===node.body?node:C.L(node.param,body));continue;}
      const arg=values.pop(),fn=values.pop(),candidates=node.fn.type==='abs'?registry.get(node.fn.param):null;
      if(fn.type==='abs'&&(declaredOnly?generatedBindings.has(node):candidates?.some(value=>C.equal(value,node.arg)))){
        const count=occurrences(fn.body,fn.param);
        if(!count){values.push(fn.body);continue;}
        if(count===1){values.push(C.substitute(fn.body,fn.param,arg));continue;}
      }
      values.push(fn===node.fn&&arg===node.arg?node:C.A(fn,arg));
    }
    return values[0];
  }
  function importDefinitions(functions,definitions,selected=null,{collision='skip',exact=false}={}) {
    if(!COLLISIONS.includes(collision))throw new C.LambdaError('函数重名处理方式不合法。');
    if(exact)return importExact(functions,definitions,selected,collision);
    const registry=new Map(),resolved=new Map(),visiting=new Set(),desired=new Map(),packed=new Map(),next=functions.slice(),added=[],skipped=new Set(),ready=new Set(),inlined=[],renamed=[],replaced=[],reused=new Set(),bindings=Object.create(null);
    for(const entry of definitions){
      if(!validName(entry.name)||registry.has(entry.name))throw new C.LambdaError('教程函数名称无效或重复。');
      const existing=collision==='reuse'?functions.find(fn=>fn.name===entry.name):null;
      registry.set(entry.name,{...entry,parsed:existing?.term??C.parse(entry.source,Infinity),existing});
    }
    function intended(name){
      if(desired.has(name))return desired.get(name);
      const entry=registry.get(name);if(!entry)throw new C.LambdaError(`没有找到教程函数 ${name}。`);
      if(entry.existing){reused.add(name);desired.set(name,entry.existing.term);return entry.existing.term;}
      if(visiting.has(name))throw new C.LambdaError(`教程函数存在循环引用：${name}`);
      visiting.add(name);
      const dependencies=[...C.freeVars(entry.parsed)].filter(name=>registry.has(name)).map(name=>({name,term:intended(name)}));
      const term=expand(entry.parsed,dependencies);visiting.delete(name);desired.set(name,term);return term;
    }
    const requested=selected===null?[...registry.keys()]:[...selected];
    function visit(name){
      if(resolved.has(name))return resolved.get(name);
      const entry=registry.get(name);if(!entry)throw new C.LambdaError(`没有找到教程函数 ${name}。`);
      const existing=next.find(fn=>fn.name===name);
      if(existing){
        if(collision==='reuse'){reused.add(name);bindings[name]=name;resolved.set(name,existing);return existing;}
        if(C.equal(existing.term,intended(name))||C.equal(existing.term,bundle(name))){ready.add(name);bindings[name]=name;resolved.set(name,existing);return existing;}
        if(collision==='skip'){skipped.add(name);bindings[name]=name;resolved.set(name,existing);return existing;}
      }
      intended(name); // Validate this dependency graph before creating entries.
      const body=bundle(name);let actual=name;
      if(existing&&collision==='rename'){
        const prefix=name,numbered=next.find(fn=>fn.name.startsWith(prefix)&&/^[0-9]+$/.test(fn.name.slice(prefix.length))&&(C.equal(fn.term,intended(name))||C.equal(fn.term,body)));
        if(numbered){ready.add(numbered.name);bindings[name]=numbered.name;renamed.push({from:name,to:numbered.name});resolved.set(name,numbered);return numbered;}
        actual=availableName(name,next,[...requested,...C.freeVars(body)]);renamed.push({from:name,to:actual});
      }
      const definition={name:actual,source:C.equal(body,entry.parsed)?entry.source:C.format(body),body,term:body};
      if(existing&&collision==='replace'){next[next.indexOf(existing)]=definition;replaced.push(name);}else{next.push(definition);added.push(actual);}
      bindings[name]=actual;
      resolved.set(name,definition);return definition;
    }
    function bundle(name){
      if(packed.has(name))return packed.get(name);
      intended(name);
      const bindings=[],seen=new Set();
      function dependency(key){if(seen.has(key))return;seen.add(key);const entry=registry.get(key);if(!entry.existing)for(const child of C.freeVars(entry.parsed))if(registry.has(child))dependency(child);bindings.push(entry);}
      for(const key of C.freeVars(registry.get(name).parsed))if(registry.has(key))dependency(key);
      let body=registry.get(name).parsed;
      const protectedNames=new Set(bindings.map(entry=>entry.name)),used=new Set(protectedNames);
      for(const entry of bindings)for(const free of C.freeVars(intended(entry.name)))protectedNames.add(free);
      const stack=[body,...bindings.map(entry=>entry.parsed)];while(stack.length){const t=stack.pop();if(t.type==='var')used.add(t.name);else if(t.type==='abs'){used.add(t.param);stack.push(t.body);}else stack.push(t.fn,t.arg);}
      const parameters=[];
      while(body.type==='abs'){
        let param=body.param,next=body.body;
        if(protectedNames.has(param)){let fresh=param;do{fresh+="'";}while(used.has(fresh)||protectedNames.has(fresh));used.add(fresh);next=C.substitute(next,param,C.V(fresh));param=fresh;}
        parameters.push(param);body=next;
      }
      const opaqueFree=new Set(bindings.filter(entry=>entry.existing).flatMap(entry=>[...C.freeVars(entry.parsed)])),localNames=new Map();
      for(const entry of bindings)if(opaqueFree.has(entry.name)){let fresh=entry.name;do{fresh+="'";}while(used.has(fresh)||protectedNames.has(fresh));used.add(fresh);localNames.set(entry.name,fresh);}
      const local=term=>{for(const [name,fresh]of localNames)term=C.substitute(term,name,C.V(fresh));return term;};
      body=local(body);
      for(const entry of [...bindings].reverse())body=helperBinding(localNames.get(entry.name)??entry.name,body,entry.existing?entry.parsed:local(entry.parsed));
      for(const param of parameters.reverse())body=C.L(param,body);
      packed.set(name,body);return body;
    }
    for(const name of requested)visit(name);
    validate(next);return {functions:next,added,skipped:[...skipped],ready:[...ready],inlined,renamed,replaced,reused:[...reused],bindings};
  }
  function importFeedback(result){
    let text=result.added.length?`已加入 ${result.added.length} 个函数并保存存档。`:'未新增函数。';
    if(result.ready.length)text+=' 已有相同定义，已准备好：'+result.ready.join('、')+'。';
    if(result.skipped.length)text+=' 重名已跳过：'+result.skipped.join('、')+'。';
    if(result.replaced?.length)text+=' 重名已替换：'+result.replaced.join('、')+'。';
    if(result.renamed?.length)text+=' 重名已加数字：'+result.renamed.map(item=>item.from+' → '+item.to).join('、')+'。';
    if(result.reused?.length)text+=' 已直接使用同名函数：'+result.reused.join('、')+'（沿用现有定义）。';
    if(result.exact)text+=' 已逐字核对'+result.verified.length+'个函数定义；名称和原始表达式与示例一致。';else if(result.added.length)text+=' 所需辅助定义已封装在入口函数内部。';
    return text;
  }
  const API={LIMITS,COLLISIONS,availableName,validName,validate,expand,functionValue,encodingsFor,captureHelpers,closeHelpers,linkHelpersInPlace,add,update,remove,importDefinitions,importFeedback};root.LambdaLibrary=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
