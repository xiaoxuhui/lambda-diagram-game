(function(root) {
  'use strict';
  const C=root.LambdaCore || require('./core.js');
  const LIMITS={count:Infinity,nodes:Infinity,nameChars:Infinity};
  const validName=name=>typeof name==='string'&&/^[A-Za-z][A-Za-z0-9_']{0,31}$/.test(name);
  function names(t,out=new Set()) {
    if(t.type==='var')out.add(t.name);
    else if(t.type==='abs'){out.add(t.param);names(t.body,out);}
    else{names(t.fn,out);names(t.arg,out);}return out;
  }
  function validate(functions) {
    if(!Array.isArray(functions))throw new C.LambdaError('函数库格式不合法。');
    const seen=new Set();let nodes=0,nameChars=0;
    for(const fn of functions) {
      if(!validName(fn.name))throw new C.LambdaError('函数名需以英文字母开头，最多 32 字符，可含数字、下划线和单引号。');
      if(seen.has(fn.name))throw new C.LambdaError(`函数「${fn.name}」已存在，请换一个名字。`);
      seen.add(fn.name);nodes+=C.inspect(fn.term).nodes;
      const stack=[fn.term];while(stack.length){const t=stack.pop();if(t.type==='var')nameChars+=t.name.length;else if(t.type==='abs'){nameChars+=t.param.length;stack.push(t.body);}else stack.push(t.fn,t.arg);}
    }
    return functions;
  }
  function expand(term,functions) {
    const registry=new Map(functions.map(f=>[f.name,f.term])),free=C.freeVars(term);
    const used=names(term);for(const f of functions)names(f.term,used);
    const replacements=[];let next=0,result=term;
    for(const name of free) {
      if(!registry.has(name))continue;
      let placeholder;do{placeholder=`lambdaMacro${++next}`;}while(used.has(placeholder));used.add(placeholder);
      result=C.substitute(result,name,C.V(placeholder));replacements.push([placeholder,registry.get(name)]);
    }
    for(const [placeholder,definition] of replacements)result=C.substitute(result,placeholder,definition);
    C.inspect(result);return result;
  }
  function add(functions,name,source,maxChars=C.LIMITS.chars) {
    name=name.trim();
    if(!validName(name))throw new C.LambdaError('函数名需以英文字母开头，最多 32 字符，可含数字、下划线和单引号。');
    if(functions.some(f=>f.name===name))throw new C.LambdaError(`函数「${name}」已存在，请换一个名字。`);
    const parsed=C.parse(source,maxChars);
    if(C.freeVars(parsed).has(name))throw new C.LambdaError('定义不能直接引用自身。递归请使用显式不动点组合子。');
    const result=[...functions,{name,term:expand(parsed,functions)}];validate(result);return result;
  }
  const remove=(functions,name)=>functions.filter(f=>f.name!==name);
  function update(functions,originalName,name,source) {
    if(!functions.some(fn=>fn.name===originalName))throw new C.LambdaError('要编辑的函数已不存在。');
    const others=remove(functions,originalName);
    const replacement=add(others,name,source,Infinity).at(-1);
    return functions.map(fn=>fn.name===originalName?replacement:fn);
  }
  const API={LIMITS,validName,validate,expand,add,update,remove};root.LambdaLibrary=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
