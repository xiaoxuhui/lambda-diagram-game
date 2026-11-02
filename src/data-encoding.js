(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  const builtins=new Map([['church','church'],['丘奇数','church'],['decimal','decimal'],['列表小数','decimal']]);
  const literalCache=new WeakMap();
  const validName=name=>typeof name==='string'&&/^[\p{L}][\p{L}\p{N}_']*$/u.test(name)&&!builtins.has(name);
  function validate(entries){
    if(!Array.isArray(entries))throw new C.LambdaError('自定义数据编码列表不合法。');
    const names=new Set();
    for(const entry of entries){
      if(!entry||!validName(entry.name)||names.has(entry.name))throw new C.LambdaError('编码名称重复或不合法；请以字母或汉字开头，内置编码名称不能占用。');
      if(typeof entry.source!=='string'||!entry.term)throw new C.LambdaError('数据转换函数缺失。');
      C.inspect(entry.term);if(C.freeVars(entry.term).size)throw new C.LambdaError('数据转换函数不能含未定义的自由变量。');
      if(entry.table!==undefined&&!Array.isArray(entry.table))throw new C.LambdaError('数字表达式对照表不合法。');
      const values=new Set();
      for(const row of entry.table??[]){
        if(!row||typeof row.number!=='string'||!(/^(0|[1-9][0-9]*)$/.test(row.number))||values.has(row.number))throw new C.LambdaError('对照表数字重复或不合法。');
        if(!row.term||C.freeVars(row.term).size||C.findRedex(row.term))throw new C.LambdaError('对照表需要闭合且已归约到正规形的表达式。');
        values.add(row.number);
      }
      names.add(entry.name);
    }
    return entries;
  }
  function define(entries,name,source,expand=term=>term,editing=null){
    validate(entries);name=name.trim();
    if(!validName(name))throw new C.LambdaError('编码名称需以字母或汉字开头，可含数字、下划线和单引号；不能使用内置编码名称。');
    if(editing!==null&&!entries.some(entry=>entry.name===editing))throw new C.LambdaError('要编辑的数据编码已不存在。');
    if(entries.some(entry=>entry.name===name&&entry.name!==editing))throw new C.LambdaError(`编码「${name}」已存在，请选择它进行编辑。`);
    // Converter definitions always receive Church numbers; they do not recursively encode themselves.
    const original=entries.find(entry=>entry.name===editing);
    const term=original?.source===source?original.term:expand(parse(source,entries).term);
    const entry={name,source,term,...(original?.table?{table:original.term===term?original.table:[]}:{})};validate([entry]);
    return editing===null?[...entries,entry]:entries.map(old=>old.name===editing?entry:old);
  }
  function parse(source,entries=[],maxChars=Infinity,defaultEncoding='church'){
    validate(entries);const registry=new Map(entries.map(entry=>[entry.name,entry.term])),encodings=new Set(),literals=[];
    const selected=defaultEncoding.startsWith('custom:')?defaultEncoding.slice(7):builtins.get(defaultEncoding)||defaultEncoding;
    const term=C.parse(source,maxChars,(value,suffix,position)=>{
      const encoding=suffix===null?selected:builtins.get(suffix)||suffix;
      try{
        if(encoding==='decimal'){
          const D=root.LambdaDecimal||require('./decimal.js');encodings.add('decimal');return D.encodeLiteral(value);
        }
        if(!/^[0-9]+$/.test(value))throw new C.LambdaError('丘奇数及自定义转换的输入必须为非负整数；负数或小数请使用 _decimal。');
        const church=C.parse(value);
        if(encoding==='church'){encodings.add('church');return church;}
        if(!registry.has(encoding))throw new C.LambdaError(`未定义数据编码「${encoding}」。请先保存对应转换函数。`);
        encodings.add(encoding);const definition=registry.get(encoding),term=C.A(definition,church);
        literals.push({name:encoding,number:naturalNumber(value),definition,term});return term;
      }catch(error){if(error.position===null||error.position===undefined)error.position=position;throw error;}
    },{suffixes:true});
    return {term,encodings:[...encodings],literals};
  }
  async function compile(source,entries=[],defaultEncoding='church',options={}){
    const parsed=parse(source,entries,options.maxChars??Infinity,defaultEncoding),replacements=new WeakMap(),mappings=[];
    const canceled=()=>{if(options.signal?.aborted){const error=new C.LambdaError('数字编码已取消。');error.name='AbortError';throw error;}};
    for(const literal of parsed.literals){
      canceled();let cache=literalCache.get(literal.definition);if(!cache){cache=new Map();literalCache.set(literal.definition,cache);}
      let term=cache.get(literal.number),steps=0;
      if(!term){
        term=literal.term;let started=performance.now();
        while(true){
          canceled();const next=C.step(term);if(!next)break;term=next.term;steps++;
          if(performance.now()-started>=8){options.onProgress?.({...literal,steps});await new Promise(resolve=>setTimeout(resolve,0));started=performance.now();}
        }
        canceled();cache.set(literal.number,term);
      }
      replacements.set(literal.term,term);mappings.push({...literal,term,steps});
    }
    canceled();const rebuilt=new WeakMap(),stack=[[parsed.term,false]];
    while(stack.length){
      const [node,done]=stack.pop();if(rebuilt.has(node))continue;
      if(replacements.has(node)){rebuilt.set(node,replacements.get(node));continue;}
      if(node.type==='var'){rebuilt.set(node,node);continue;}
      if(!done){stack.push([node,true]);if(node.type==='abs')stack.push([node.body,false]);else stack.push([node.arg,false],[node.fn,false]);continue;}
      if(node.type==='abs'){const body=rebuilt.get(node.body);rebuilt.set(node,body===node.body?node:C.L(node.param,body));}
      else{const fn=rebuilt.get(node.fn),arg=rebuilt.get(node.arg);rebuilt.set(node,fn===node.fn&&arg===node.arg?node:C.A(fn,arg));}
    }
    return {...parsed,term:rebuilt.get(parsed.term),mappings};
  }
  const isLiteral=source=>/^-?[0-9]+(?:\.[0-9]+)?(?:_[\p{L}][\p{L}\p{N}_']*)?$/u.test(source.trim());
  const label=name=>name==='church'?'丘奇数':name==='decimal'?'列表小数':`${name}（自定义）`;
  function naturalNumber(value){
    if(typeof value!=='string'||!(/^[0-9]+$/.test(value.trim())))throw new C.LambdaError('对照表数字需要是非负整数。');
    return BigInt(value.trim()).toString();
  }
  function putMapping(entries,name,number,term){
    validate(entries);number=naturalNumber(number);
    const original=entries.find(entry=>entry.name===name);if(!original)throw new C.LambdaError('请先保存并选择数据编码。');
    const table=[...(original.table??[])],index=table.findIndex(row=>row.number===number),row={number,term};
    if(index<0)table.push(row);else table[index]=row;
    const entry={...original,table};validate([entry]);return entries.map(old=>old===original?entry:old);
  }
  function removeMapping(entries,name,number){
    return entries.map(entry=>entry.name===name?{...entry,table:(entry.table??[]).filter(row=>row.number!==number)}:entry);
  }
  function lookup(term,entries,names){
    const selected=new Set(names),matches=[];
    for(const entry of entries)if(selected.has(entry.name))for(const row of entry.table??[])if(C.equal(term,row.term))matches.push({name:entry.name,number:row.number});
    return matches;
  }
  const API={validName,validate,define,parse,compile,isLiteral,label,naturalNumber,putMapping,removeMapping,lookup};root.LambdaDataEncoding=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
