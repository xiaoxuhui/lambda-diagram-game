(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  const builtinLabels={church:'丘奇数',decimal:'列表小数',list:'丘奇列表',bool:'丘奇布尔',int:'丘奇整数'};
  const builtinKeys=Object.keys(builtinLabels);
  const isBuiltin=name=>builtinKeys.includes(name);
  const builtins=new Map(Object.entries(builtinLabels).flatMap(([key,label])=>[[key,key],[label,key]]));
  const literalCache=new WeakMap();
  const validStoredName=name=>typeof name==='string'&&/^[\p{L}][\p{L}\p{N}_']*$/u.test(name)&&!['church','丘奇数','decimal','列表小数'].includes(name);
  const validName=name=>validStoredName(name)&&!builtins.has(name);
  function validateTemplate(template){
    if(typeof template!=='string'||template.split('{n}').length!==2)throw new C.LambdaError('输入形式需要且只能包含一个 {n}，例如 C{n}、{n}c 或 [{n}]。');
    const [prefix,suffix]=template.split('{n}');
    if(!prefix&&!suffix)throw new C.LambdaError('请给 {n} 加上前缀或后缀；直接输入数字会使用当前编码。');
    if(/[λ\\().\s{}]/u.test(prefix+suffix))throw new C.LambdaError('输入形式的前后缀不能使用空白、λ、反斜杠、圆括号、点或花括号。');
    return {prefix,suffix};
  }
  function formatSpecs(entries,numberFormats={}){
    if(!numberFormats||typeof numberFormats!=='object'||Array.isArray(numberFormats)||Object.keys(numberFormats).some(key=>!isBuiltin(key)))throw new C.LambdaError('内置数字输入形式不合法。');
    const specs=[...builtinKeys.map(key=>({encoding:key,key,canonical:`{n}_${key}`,template:numberFormats[key]??`{n}_${key}`})),...entries.map(entry=>({encoding:entry.name,key:`custom:${entry.name}`,canonical:`{n}_${entry.name}`,template:entry.inputFormat??`{n}_${entry.name}`}))];
    const reserved=new Map([...Array.from(builtins,([name,key])=>[`{n}_${name}`,key]),...entries.map(entry=>[`{n}_${entry.name}`,`custom:${entry.name}`])]),seen=new Set();
    for(const spec of specs){
      validateTemplate(spec.template);
      // These new default spellings must not invalidate older custom formats.
      if(['list','bool','int'].includes(spec.key)&&spec.template===spec.canonical)continue;
      const owner=reserved.get(spec.template);
      if(owner&&owner!==spec.key&&!['list','bool','int'].includes(owner))throw new C.LambdaError('这个写法属于另一种编码的标准后缀，请换一个输入形式。');
      if(seen.has(spec.template))throw new C.LambdaError('这个输入形式已被另一种编码使用。');seen.add(spec.template);
    }
    return specs;
  }
  function inputFormatFor(selection,entries=[],numberFormats={}){return formatSpecs(entries,numberFormats).find(spec=>spec.key===selection)?.template??'{n}_church';}
  function literalMatcher(entries,numberFormats={}){
    const escape=text=>[...text].map(char=>'^$.*+?()[]{}|'.includes(char)?String.fromCharCode(92)+char:char).join('');
    const patterns=formatSpecs(entries,numberFormats).filter(spec=>spec.template!==spec.canonical).map(spec=>{const {prefix,suffix}=validateTemplate(spec.template);return {...spec,pattern:new RegExp('^'+escape(prefix)+'(-?[0-9]+(?:[.][0-9]+)?)'+escape(suffix),'u')};});
    const word=char=>!!char&&/[\p{L}\p{N}_']/u.test(char);
    return (source,position)=>{
      const matches=[];
      for(const spec of patterns){
        const match=spec.pattern.exec(source.slice(position));if(!match)continue;
        if((word(match[0][0])&&word(source[position-1]))||(word(match[0].at(-1))&&word(source[position+match[0].length])))continue;
        matches.push({value:match[1],encoding:spec.encoding,length:match[0].length});
      }
      if(!matches.length)return null;
      const longest=Math.max(...matches.map(match=>match.length)),best=matches.filter(match=>match.length===longest);
      if(best.length>1)throw new C.LambdaError('这个数字同时匹配多个输入形式，请使用明确的「数字_编码名称」。',position);
      return best[0];
    };
  }
  function validate(entries){
    if(!Array.isArray(entries))throw new C.LambdaError('自定义数据编码列表不合法。');
    const names=new Set();
    for(const entry of entries){
      if(!entry||!validStoredName(entry.name)||names.has(entry.name))throw new C.LambdaError('编码名称重复或不合法；请以字母或汉字开头，内置编码名称不能占用。');
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
    formatSpecs(entries);return entries;
  }
  function define(entries,name,source,expand=term=>term,editing=null,numberFormats={}){
    validate(entries);name=name.trim();
    if(name===editing?!validStoredName(name):!validName(name))throw new C.LambdaError('编码名称需以字母或汉字开头，可含数字、下划线和单引号；不能使用内置编码名称。');
    if(editing!==null&&!entries.some(entry=>entry.name===editing))throw new C.LambdaError('要编辑的数据编码已不存在。');
    if(entries.some(entry=>entry.name===name&&entry.name!==editing))throw new C.LambdaError(`编码「${name}」已存在，请选择它进行编辑。`);
    // Converter definitions always receive Church numbers; they do not recursively encode themselves.
    const original=entries.find(entry=>entry.name===editing);
    const term=original?.source===source?original.term:expand(parse(source,entries,Infinity,'church',numberFormats).term);
    const entry={name,source,term,...(original?.inputFormat&&original.inputFormat!==`{n}_${original.name}`?{inputFormat:original.inputFormat}:{}),...(original?.table?{table:original.term===term?original.table:[]}:{})};
    const result=editing===null?[...entries,entry]:entries.map(old=>old.name===editing?entry:old);validate(result);formatSpecs(result,numberFormats);return result;
  }
  function parse(source,entries=[],maxChars=Infinity,defaultEncoding='church',numberFormats={}){
    validate(entries);const registry=new Map(entries.map(entry=>[entry.name,entry.term])),encodings=new Set(),literals=[];
    const selected=defaultEncoding.startsWith('custom:')?defaultEncoding:builtins.get(defaultEncoding)||defaultEncoding;
    const term=C.parse(source,maxChars,(value,suffix,position,listDepth)=>{
      const encoding=suffix===null?(selected==='list'&&listDepth>0?'church':selected):registry.has(suffix)?`custom:${suffix}`:builtins.get(suffix)||suffix;
      try{
        if(encoding==='decimal'){
          const D=root.LambdaDecimal||require('./decimal.js');encodings.add('decimal');return D.encodeLiteral(value);
        }
        if(encoding==='int'){
          if(!/^-?[0-9]+$/.test(value))throw new C.LambdaError('丘奇整数只接受整数；小数请使用 _decimal。');
          const negative=value.startsWith('-')&&!/^-0+$/.test(value);
          const magnitude=C.parse(value.replace(/^-/, ''));
          encodings.add(encoding);
          return C.L('k',C.A(C.A(C.A(C.V('k'),integerTag),negative?TRUE:FALSE),magnitude));
        }
        if(!/^[0-9]+$/.test(value))throw new C.LambdaError('这个编码需要非负整数；负整数可用 _int，负小数可用 _decimal。');
        if(encoding==='bool'){
          const number=BigInt(value);
          if(number>1n)throw new C.LambdaError('丘奇布尔只接受 0（假）或 1（真）。');
          encodings.add(encoding);return number===0n?FALSE:TRUE;
        }
        if(encoding==='list'){
          encodings.add(encoding);
          return C.churchList([...BigInt(value).toString()].map(digit=>C.parse(digit)));
        }
        const church=C.parse(value);
        if(encoding==='church'){encodings.add('church');return church;}
        const name=encoding.startsWith('custom:')?encoding.slice(7):encoding;
        if(!registry.has(name))throw new C.LambdaError(`未定义数据编码「${name}」。请先保存对应转换函数。`);
        encodings.add(name);const definition=registry.get(name),term=C.A(definition,church);
        literals.push({name,number:naturalNumber(value),definition,term});return term;
      }catch(error){if(error.position===null||error.position===undefined)error.position=position;throw error;}
    },{suffixes:true,literalMatcher:literalMatcher(entries,numberFormats),onList:()=>encodings.add('list')});
    return {term,encodings:[...encodings],literals};
  }
  async function compile(source,entries=[],defaultEncoding='church',options={}){
    const parsed=parse(source,entries,options.maxChars??Infinity,defaultEncoding,options.numberFormats??{}),replacements=new WeakMap(),mappings=[];
    const canceled=()=>{if(options.signal?.aborted){const error=new C.LambdaError('数字编码已取消。');error.name='AbortError';throw error;}};
    for(const literal of parsed.literals){
      canceled();let cache=literalCache.get(literal.definition);if(!cache){cache=new Map();literalCache.set(literal.definition,cache);}
      let term=cache.get(literal.number),steps=0;
      if(!term){
        term=literal.term;const repeated=C.cycleCheck(term);let started=performance.now();
        while(true){
          canceled();const next=C.step(term);if(!next)break;term=next.term;steps++;
          if(repeated(term,next))throw new C.LambdaError(`数字编码「${literal.name}」进入重复归约循环。`);
          if(performance.now()-started>=8){options.onProgress?.({...literal,steps});await new Promise(resolve=>setTimeout(resolve,12));started=performance.now();}
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
  function isLiteral(source,entries=[],numberFormats={}){
    source=source.trim();if(/^-?[0-9]+(?:\.[0-9]+)?(?:_[\p{L}][\p{L}\p{N}_']*)?$/u.test(source))return true;
    try{const match=literalMatcher(entries,numberFormats)(source,0);return !!match&&match.length===source.length;}catch{return false;}
  }
  const TRUE=C.parse('λx y.x'),FALSE=C.parse('λx y.y'),integerTag=C.parse('λa b c d.d');
  const label=name=>isBuiltin(name)?builtinLabels[name]:`${name}（自定义）`;
  function readBuiltin(term,encoding){
    if(encoding==='bool')return C.equal(term,TRUE)?'丘奇布尔 TRUE（1）':C.equal(term,FALSE)?'丘奇布尔 FALSE（0）':null;
    if(encoding==='int'){
      if(term.type!=='abs')return null;
      const {body}=term;
      if(body.type!=='app'||body.fn.type!=='app'||body.fn.fn.type!=='app')return null;
      const {fn:head,arg:tag}=body.fn.fn;
      if(head.type!=='var'||head.name!==term.param||!C.equal(tag,integerTag))return null;
      const negative=C.equal(body.fn.arg,TRUE);
      const magnitude=C.churchNumber(body.arg);
      if(magnitude===null||(!negative&&!C.equal(body.fn.arg,FALSE)))return null;
      return `丘奇整数 ${negative&&magnitude!==0?'-':''}${magnitude}`;
    }
    return encoding==='list'?readChurchList(term,true):null;
  }
  function listItems(term){
    if(term.type!=='abs'||term.body.type!=='abs'||term.param===term.body.param)return null;
    const c=term.param,n=term.body.param,items=[];let body=term.body.body;
    while(body.type==='app'&&body.fn.type==='app'&&body.fn.fn.type==='var'&&body.fn.fn.name===c){
      const item=body.fn.arg,free=C.freeVars(item);
      if(free.has(c)||free.has(n))return null;
      items.push(item);body=body.arg;
    }
    return body.type==='var'&&body.name===n?items:null;
  }
  function readChurchList(term,allowEmpty=false){
    const items=listItems(term);
    if(!items||(!allowEmpty&&!items.length))return null;
    const parts=['丘奇列表 '],stack=[items];
    while(stack.length){
      const entry=stack.pop();
      if(typeof entry==='string'){parts.push(entry);continue;}
      if(Array.isArray(entry)){
        parts.push('[');stack.push(']');
        for(let i=entry.length-1;i>=0;i--){stack.push(entry[i]);if(i)stack.push(', ');}
        continue;
      }
      const number=C.churchNumber(entry);
      if(number!==null){parts.push(String(number));continue;}
      const nested=listItems(entry);
      if(nested?.length)stack.push(nested);else parts.push(C.format(entry));
    }
    return parts.join('');
  }
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
  function withInputFormat(entries,name,template,numberFormats={}){
    if(!entries.some(entry=>entry.name===name))throw new C.LambdaError('这个数据编码已不存在。');
    const result=entries.map(entry=>{if(entry.name!==name)return entry;const changed={...entry};if(template===`{n}_${name}`)delete changed.inputFormat;else changed.inputFormat=template;return changed;});
    validate(result);formatSpecs(result,numberFormats);return result;
  }
  const API={isBuiltin,readBuiltin,readChurchList,validName,validate,define,parse,compile,isLiteral,label,naturalNumber,putMapping,removeMapping,lookup,validateTemplate,validateFormats:formatSpecs,inputFormatFor,withInputFormat};root.LambdaDataEncoding=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
