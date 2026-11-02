(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  const builtins=new Map([['church','church'],['丘奇数','church'],['decimal','decimal'],['列表小数','decimal']]);
  const validName=name=>typeof name==='string'&&/^[\p{L}][\p{L}\p{N}_']*$/u.test(name)&&!builtins.has(name);
  function validate(entries){
    if(!Array.isArray(entries))throw new C.LambdaError('自定义数据编码列表不合法。');
    const names=new Set();
    for(const entry of entries){
      if(!entry||!validName(entry.name)||names.has(entry.name))throw new C.LambdaError('编码名称重复或不合法；请以字母或汉字开头，内置编码名称不能占用。');
      if(typeof entry.source!=='string'||!entry.term)throw new C.LambdaError('数据转换函数缺失。');
      C.inspect(entry.term);if(C.freeVars(entry.term).size)throw new C.LambdaError('数据转换函数不能含未定义的自由变量。');
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
    const term=original?.source===source?original.term:expand(C.parse(source));
    const entry={name,source,term};validate([entry]);
    return editing===null?[...entries,entry]:entries.map(old=>old.name===editing?entry:old);
  }
  function parse(source,entries=[],maxChars=Infinity){
    validate(entries);const registry=new Map(entries.map(entry=>[entry.name,entry.term])),encodings=new Set();
    const term=C.parse(source,maxChars,(value,suffix,position)=>{
      const encoding=suffix===null?'church':builtins.get(suffix)||suffix;
      try{
        if(encoding==='decimal'){
          const D=root.LambdaDecimal||require('./decimal.js');encodings.add('decimal');return D.encodeLiteral(value);
        }
        if(!/^[0-9]+$/.test(value))throw new C.LambdaError('丘奇数及自定义转换的输入必须为非负整数；负数或小数请使用 _decimal。');
        const church=C.parse(value);
        if(encoding==='church'){encodings.add('church');return church;}
        if(!registry.has(encoding))throw new C.LambdaError(`未定义数据编码「${encoding}」。请先保存对应转换函数。`);
        encodings.add(encoding);return C.A(registry.get(encoding),church);
      }catch(error){if(error.position===null||error.position===undefined)error.position=position;throw error;}
    },{suffixes:true});
    return {term,encodings:[...encodings]};
  }
  const label=name=>name==='church'?'丘奇数':name==='decimal'?'列表小数':`${name}（自定义）`;
  const API={validName,validate,define,parse,label};root.LambdaDataEncoding=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
