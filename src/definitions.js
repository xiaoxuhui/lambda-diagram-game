(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js'),L=root.LambdaLibrary||require('./library.js'),E=root.LambdaDataEncoding||require('./data-encoding.js');
  function statements(source){
    const out=[];let start=0,depth=0,quoted=false;
    for(let i=0;i<=source.length;i++){
      const char=source[i];if(char==='`')quoted=!quoted;
      if(!quoted){if(char==='('||char==='[')depth++;else if(char===')'||char===']')depth--;}
      if(i===source.length||char==='\n'&&!quoted&&depth===0){const raw=source.slice(start,i),leading=raw.search(/\S/);if(leading>=0)out.push({text:raw.trim(),offset:start+leading});start=i+1;}
    }return out;
  }
  function assignment(statement){
    let quoted=false,depth=0;
    for(let i=0;i<statement.text.length;i++){
      const char=statement.text[i];if(char==='`')quoted=!quoted;
      if(!quoted){if(char==='('||char==='[')depth++;else if(char===')'||char===']')depth--;}
      if(char!=='='||quoted||depth)continue;
      let name=statement.text.slice(0,i).trim();if(name.startsWith('`')&&name.endsWith('`'))name=name.slice(1,-1);
      if(!C.validName(name))return null;
      const tail=statement.text.slice(i+1),leading=tail.search(/\S/);if(leading<0)throw new C.LambdaError('等号后请填写函数定义；跨行表达式请放在括号内。',statement.offset+i+1);
      return {name,source:tail.trim(),offset:statement.offset+i+1+leading};
    }return null;
  }
  function parseProgram(source){
    if(!source.includes('='))return {definitions:[],expression:source,expressionOffset:0};
    const definitions=[],parts=statements(source);let expression=null,expressionOffset=source.length;
    for(const part of parts){const definition=assignment(part);if(expression!==null){if(definition)throw new C.LambdaError('函数定义请写在要运行的算式之前。',part.offset);continue;}if(definition)definitions.push(definition);else{expression=source.slice(part.offset);expressionOffset=part.offset;}}
    return definitions.length?{definitions,expression,expressionOffset}:{definitions:[],expression:source,expressionOffset:0};
  }
  function aliasesOf(term,aliases){const entries=[...aliases].filter(([from,to])=>from!==to).map(([name,to])=>({name,term:C.V(to)}));return entries.length?L.expand(term,entries):term;}
  async function prepare(source,functions=[],{collision='skip',encodings=[],encoding='church',numberFormats={},signal,onProgress,compileExpression=true,prepareTerm=term=>term}={}){
    if(!L.COLLISIONS.includes(collision))throw new C.LambdaError('函数重名处理方式不合法。');
    const program=E.isLiteral(source,encodings,numberFormats)?{definitions:[],expression:source,expressionOffset:0}:parseProgram(source),aliases=new Map(),result={added:[],ready:[],skipped:[],renamed:[],replaced:[],reused:[]},mappings=[],dataTerms=[],seenEncodings=new Set();let next=functions.slice();
    const canceled=()=>{if(signal?.aborted){const error=new Error('定义已取消。');error.name='AbortError';throw error;}};
    const compile=async(text,offset)=>{try{return await E.compile(text,encodings,encoding,{numberFormats,signal,onProgress});}catch(error){if(error.position!==null&&error.position!==undefined)error.position+=offset;throw error;}};
    const remember=compiled=>{mappings.push(...compiled.mappings);dataTerms.push(...compiled.dataTerms);for(const name of compiled.encodings)seenEncodings.add(name);};
    const reserved=program.definitions.map(definition=>definition.name);
    for(const definition of program.definitions){
      canceled();const {name}=definition,existing=next.find(fn=>fn.name===name);
      if(existing&&collision==='reuse'){aliases.set(name,name);result.reused.push(name);continue;}
      const compiled=await compile(definition.source,definition.offset),term=prepareTerm(aliasesOf(compiled.term,aliases),next),prepared={...compiled,term},expanded=L.expand(term,next);let actual=name;
      if(existing){
        if(C.equal(existing.term,expanded)){result.ready.push(name);aliases.set(name,name);continue;}
        if(collision==='skip'){result.skipped.push(name);aliases.set(name,name);continue;}
        if(collision==='rename'){
          const numbered=next.find(fn=>fn.name.startsWith(name)&&/^[0-9]+$/.test(fn.name.slice(name.length))&&C.equal(fn.term,expanded));
          if(numbered){aliases.set(name,numbered.name);result.ready.push(numbered.name);result.renamed.push({from:name,to:numbered.name});continue;}
          actual=L.availableName(name,next,[...reserved,...C.freeVars(term)]);result.renamed.push({from:name,to:actual});
        }
      }
      try{next=existing&&collision==='replace'?L.update(next,name,name,definition.source,encoding,6,encodings,prepared):L.add(next,actual,definition.source,Infinity,encoding,6,encodings,prepared);}catch(error){if(error.position!==null&&error.position!==undefined)error.position+=definition.offset;throw error;}
      aliases.set(name,actual);(existing&&collision==='replace'?result.replaced:result.added).push(actual);remember(compiled);
    }
    canceled();let compiled=null;
    if(compileExpression&&program.expression!==null){const value=await compile(program.expression,program.expressionOffset);compiled={...value,term:aliasesOf(value.term,aliases)};remember(value);}
    return {program,functions:next,compiled,mappings,dataTerms,encodings:[...seenEncodings],aliases,result};
  }
  const API={parseProgram,prepare};root.LambdaDefinitions=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
