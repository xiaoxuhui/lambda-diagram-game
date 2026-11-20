(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  const preferred={
    I:'id',i:'id',TRUE:'true',t:'true',K:'true',FALSE:'false',f:'false',NIL:'false',nil:'false',
    ADD:'add',add:'add',APPEND:'add',MUL:'mul',mul:'mul',compose:'mul',B:'mul',
    SUCC:'succ',succ:'succ',PRED:'pred',pred:'pred',SUB:'sub',sub:'sub',ISZERO:'iszero',zero:'iszero',
    PAIR:'pair',pair:'pair',FIRST:'first',fst:'first',SECOND:'second',snd:'second',Y:'fix',y:'fix',
    POW:'pow',POWER:'power',LE:'leq',ATMOST:'atmost',
    CONS:'cons',cons:'node',HEAD:'pick',TAIL:'tail',EMPTY:'empty',LENGTH:'length',MAP:'map',REVERSE:'reverse',FILTER:'filter',
    not:'not',and:'and',or:'pick',xor:'xor',head:'head',tail:'rest',empty:'empty',lt:'lt',eq:'eq',
    trim:'trim',reverse:'rev',pad:'pad',cmp:'cmp',plus:'plus',minus:'minus',split:'split',timesdigit:'timesdigit',times:'times',
    sign:'sign',digits:'digits',scale:'scale',approx:'approx',make:'make',maxScale:'maxscale',alignAt:'alignat',align:'align',sumAligned:'sumaligned',
    dadd:'dadd',dsub:'dsub',dmul:'dmul',ddiv:'ddiv',negate:'neg',dneg:'neg',dabs:'abs',dpow:'dpow',powerBy:'powerby',dshl:'shl',dshr:'shr',
    one:'one',half:'half',cut:'cut',work:'work',estimate:'estimate',forceNat:'forcenat',force:'force',forceDigit:'forcedigit',forceList:'forcelist',table:'table',
    divstep:'divstep',longdiv:'longdiv',error:'diverror',domain:'rooterror',angleError:'angleerror',rangeError:'rangeerror',nonnegativeLess:'less',dsqrt:'sqrt',
    sinSeries:'sinseries',cosSeries:'cosseries',sinhSeries:'sinhseries',coshSeries:'coshseries',pi:'pi',halfPi:'halfpi',quarterPi:'quarterpi',period:'period',
    smallSin:'smallsin',halfWave:'halfwave',fullWave:'fullwave',sinAngle:'sinangle',cosAngle:'cosangle',withinAngle:'withinangle',withinRange:'withinrange',
    dsin:'sin',dcos:'cos',dtan:'tan',dsinh:'sinh',dcosh:'cosh',dtanh:'tanh',
    rmul:'rmul',rdiv:'rdiv',radd:'radd',rsub:'rsub',fold:'fold',evalpoly:'evalpoly',divmod:'divmod',encodepoly:'encodepoly',diff:'diff',integ:'integ',
    CHOOSE:'choose',PERM:'perm',SUM1:'sum',SUM2:'sum2',SUM3:'sum3',GEOSUM:'geosum',BINOM:'binom',TET:'tet',PENT:'pent',SEARCH:'search',ROOT:'root',QUOT:'quot',LOG:'log',SLOG:'slog',SROOT:'sroot',PROOT:'proot',PLOG:'plog',
    S:'applyboth',C:'flip',W:'dup',Ω:'omega',A:'predstep',Z:'predseed',FAC:'factorial',predicate:'nonzero',next:'mark',chain:'chain',bound:'boundterm',freeTerm:'freeterm',abs:'lambdaterm',app:'applyterm',get:'lookup',decode:'decodeterm',evalTerm:'evalterm'
  };
  const shortNames={first:'fst',second:'snd',fix:'y',applyboth:'s',flip:'c',dup:'w',factorialiter:'fac',factorialstep:'facstep',factorial:'recfac',fibonacci:'fib'};
  function shortParameter(name,body,bindings,resolve){
    const used=new Set(bindings.values()),pending=[body];
    while(pending.length){const node=pending.pop();if(node.type==='var'){if(node.name!==name)used.add(bindings.get(node.name)??resolve(node.name)??node.name);}else if(node.type==='abs'){if(node.param!==name)used.add(node.param);pending.push(node.body);}else pending.push(node.fn,node.arg);}
    if(/^[a-z]$/.test(name)&&!used.has(name))return name;
    const first=name==='selector'?'f':/^[a-z]/i.test(name)?name[0].toLowerCase():'x';
    for(const candidate of new Set([first,...'fghxyzabcdeijklmnopqrstuvw']))if(!used.has(candidate))return candidate;
    let index=1;while(used.has(first+index))index++;return first+index;
  }
  function create(documents){
    const parsed=new Map(),nodes=new Map(),groups=new Map();let next=0;
    const parse=source=>{if(!parsed.has(source))parsed.set(source,C.parse(source));return parsed.get(source);};
    const intern=key=>{if(!nodes.has(key))nodes.set(key,++next);return nodes.get(key);};
    function fingerprint(term,lookup,scope=[]){
      if(term.type==='var'){const index=scope.lastIndexOf(term.name);return index>=0?intern('b:'+ (scope.length-1-index)):lookup(term.name)??intern('f:'+term.name);}
      if(term.type==='abs')return intern('l:'+fingerprint(term.body,lookup,[...scope,term.param]));
      return intern('a:'+fingerprint(term.fn,lookup,scope)+':'+fingerprint(term.arg,lookup,scope));
    }
    const contexts=new Map();
    function context(doc,key){
      const definitions=new Map(doc.symbols.map(symbol=>[symbol.name,symbol])),resolved=new Map(),resolving=new Set();
      const snippets=[doc.core,doc.foundation,doc.walkthrough,...doc.steps.map(step=>step[2])].filter(Boolean);
      for(const snippet of snippets)for(const line of snippet.split('\n')){
        const match=/^([\p{L}_][\p{L}\p{N}_']*)\s*=\s*(.+)$/u.exec(line.trim());
        if(!match||/^[a-z]$/.test(match[1])||/^(?:丘奇自然数|丘奇数|有理数)[0-9]/.test(match[1])||definitions.has(match[1]))continue;
        try{
          const term=parse(match[2]);if(term.type==='var'||!/[λ\\]/u.test(match[2]))continue;
          const title=key.split(' · ')[0];
          const display=match[1]==='主函数'?({'多项式':'evaluate','符号求导并求值':'derivative','生成导函数':'differentiate','生成原函数':'integrate','定积分':'integral'}[title]):match[1]==='step'?({'排列数':'permstep','自然数求和':'sumstep','平方和':'squarestep','立方和':'cubestep','等比求和':'geostep','丘奇列表':'reversestep'}[title]):preferred[match[1]];
          definitions.set(match[1],{name:match[1],source:match[2],meaning:'本篇关键表达式使用的函数定义。',display});
        }catch{}
      }
      function resolve(name){
        if(resolved.has(name))return resolved.get(name);
        const symbol=definitions.get(name);if(!symbol)return undefined;
        if(resolving.has(name))throw new Error('教程定义存在循环引用：'+name);resolving.add(name);
        const term=parse(symbol.source),id=fingerprint(term,dependency=>resolve(dependency)?.id);
        let group=groups.get(id);if(!group){group={id,entries:[],aliases:new Set()};groups.set(id,group);}
        group.entries.push({symbol,term,context:result});group.aliases.add(name);resolved.set(name,group);resolving.delete(name);return group;
      }
      const result={definitions,resolved,resolve,key};
      for(const name of definitions.keys())resolve(name);return result;
    }
    for(const {doc,key} of documents)contexts.set(key,context(doc,key));
    const used=new Map();
    for(const group of groups.values()){
      const entries=group.entries.filter(entry=>entry.term.type!=='var');
      entries.sort((a,b)=>C.inspect(a.term).nodes-C.inspect(b.term).nodes);
      group.representative=entries[0]??group.entries[0];
      const aliases=[...group.aliases],first=aliases.find(name=>preferred[name]);
      let name=preferred[first]??group.entries.find(entry=>entry.symbol.display)?.symbol.display??aliases[0].toLowerCase();
      group.aliases.add(name);
      name=shortNames[name]??name.toLowerCase();
      // A single spelling is never reused for a different expression.
      const original=name;let variant=2;while(used.has(name)&&used.get(name)!==group.id)name=original+(variant++);
      used.set(name,group.id);group.name=name;
    }
    const aliases=new Map();
    for(const group of groups.values())for(const alias of group.aliases){
      if(!aliases.has(alias))aliases.set(alias,group);else if(aliases.get(alias)!==group)aliases.set(alias,null);
    }
    for(const [alias,original] of Object.entries({NOT:'not',NEG:'negate',ABS:'dabs',SHIFT_LEFT:'dshl',SHIFT_RIGHT:'dshr'}))aliases.set(alias,aliases.get(original));
    const namedGroup=(ctx,name)=>ctx.resolve(name)??(name.length>1||name==='I'?aliases.get(name):undefined);
    function renamed(term,ctx,bindings=new Map()){
      if(term.type==='var')return C.V(bindings.has(term.name)?bindings.get(term.name):namedGroup(ctx,term.name)?.name??term.name);
      if(term.type==='abs'){const name=shortParameter(term.param,term.body,bindings,n=>namedGroup(ctx,n)?.name),scope=new Map(bindings);scope.set(term.param,name);return C.L(name,renamed(term.body,ctx,scope));}
      return C.A(renamed(term.fn,ctx,bindings),renamed(term.arg,ctx,bindings));
    }
    function fragment(source,transform,preserve=false){
      const literals=new Map();let index=0;
      const term=C.parse(source,Infinity,(value,suffix)=>{
        let name;do{name='讲解数值占位_'+(++index)+'_';}while(source.includes(name));
        literals.set(name,String(value)+(suffix===null?'':'_'+suffix));return C.V(name);
      },{suffixes:true});
      const result=transform(term,literals);
      if(preserve){
        // Keep parentheses and spaces: adding an iterator before a preset must
        // still apply it to the same explicitly parenthesized function.
        const tokens=/`([^`]+)`|-?[0-9]+(?:\.[0-9]+)?(?:_[^\sλ\\().\[\],`]+)?|[^\sλ\\().\[\],`]+/gu;
        const leaves=[],pending=[[term,result]];
        while(pending.length){const [before,after]=pending.pop();
          if(before.type==='var')leaves.push([before.name,after.name]);
          else if(before.type==='abs'){leaves.push([before.param,after.param]);pending.push([before.body,after.body]);}
          else pending.push([before.arg,after.arg],[before.fn,after.fn]);
        }
        const matches=[...source.matchAll(tokens)];
        if(matches.length===leaves.length&&matches.every((match,index)=>literals.has(leaves[index][0])||(match[1]??match[0])===leaves[index][0])){
          let offset=0,index=0,output='';
          for(const match of matches){const [before,after]=leaves[index++];output+=source.slice(offset,match.index)+(before===after?match[0]:C.formatName(after));offset=match.index+match[0].length;}
          return C.explicitLambdas(output+source.slice(offset));
        }
      }
      return C.format(result).replace(/讲解数值占位_[0-9]+_/g,name=>literals.get(name)??name);
    }
    for(const group of groups.values()){
      const {term,context:ctx}=group.representative;
      group.source=fragment(group.representative.symbol.source,term=>renamed(term,ctx));
    }
    const parseable=text=>!/[=→←≡≈≤≥×÷+−²³Σ∫…：，。；]/u.test(text)&&!/[fF][′']*\(/.test(text);
    function code(text,ctx){
      return C.explicitLambdas([...new Set(text.split('\n').map(line=>codeLine(line,ctx)))].join('\n'));
    }
    function codeLine(line,ctx){
      if(line.includes('；'))return line.split('；').map(part=>codeLine(part,ctx)).join('；');
      const numeral=/^([0-9]+)\s*=\s*([λ\\].+)$/u.exec(line.trim());
      if(numeral){try{const term=parse(numeral[2]),group=groups.get(fingerprint(term,name=>ctx.resolve(name)?.id));return '丘奇数'+numeral[1]+'：'+(group?.name??C.format(term));}catch{}}
      const assignment=/^([\p{L}_][\p{L}\p{N}_']*)\s*=\s*(.+)$/u.exec(line.trim());
      if(assignment&&namedGroup(ctx,assignment[1])){
        const group=namedGroup(ctx,assignment[1]);
        if(assignment[2].includes('…'))return group.name+' = '+group.source;
        try{if(fingerprint(parse(assignment[2]),name=>namedGroup(ctx,name)?.id)===group.id)return group.name+' = '+group.source;}catch{}
      }
      // Rewrite helper bindings as well as free references. A lambda parameter
      // that merely happens to share a helper's old name keeps its own scope.
      if(parseable(line))try{return fragment(source(line,ctx.key),term=>renamed(term,ctx));}catch{}
      return scan(line,ctx,true);
    }
    function scan(text,ctx,isCode=false){
      const scopes=[],tokens=/λ|\\|[()\n]|[A-Za-z_][A-Za-z0-9_']*|Ω/gu;let depth=0,param=false,pending=[];
      return text.replace(tokens,(token,offset)=>{
        if(token==='('){depth++;return token;}
        if(token===')'){depth--;while(scopes.length&&scopes.at(-1).depth>depth)scopes.pop();return token;}
        if(token==='\n'){scopes.length=0;param=false;return token;}
        if(token==='λ'||token==='\\'){
          if(!/^[λ\\]\s*[A-Za-z_][A-Za-z0-9_']*(?:\s+[A-Za-z_][A-Za-z0-9_']*)*\s*\./.test(text.slice(offset)))return token;
          param=true;pending=[];scopes.push({depth,names:pending,short:new Map()});return token;
        }
        if(param){
          // Parameters stop at the dot, which is deliberately kept outside the
          // identifier regexp so punctuation in prose cannot become a name.
          const since=text.slice(scopes.at(-1).start??offset,offset);
          if(pending.length&&since.includes('.'))param=false;
          if(param){pending.push(token);scopes.at(-1).start??=offset;let name=token;const occupied=new Set([...text.matchAll(/\b[a-zA-Z]\b/g)].map(m=>m[0]));for(const match of text.matchAll(/[A-Za-z_][A-Za-z0-9_']*/g))if(match[0]!==token){const canonical=namedGroup(ctx,match[0])?.name;if(canonical)occupied.add(canonical);}for(const scope of scopes)for(const value of scope.short.values())occupied.add(value);const first=token==='selector'?'f':token[0].toLowerCase();if(!/^[a-z]$/.test(token)||[...text.matchAll(/[A-Za-z_][A-Za-z0-9_']*/g)].some(match=>match[0]!==token&&namedGroup(ctx,match[0])?.name===token))name=[...new Set([first,...'fghxyzabcdeijklmnopqrstuvw'])].find(n=>!occupied.has(n))??first+'1';scopes.at(-1).short.set(token,name);return name;}
        }
        const binding=[...scopes].reverse().find(scope=>scope.names.includes(token));if(binding)return binding.short.get(token)??token;
        if(/^[\u2080-\u209f]/u.test(text.slice(offset+token.length)))return token;
        if(/^[ABCF]$/.test(token)&&/^[′']*\(/.test(text.slice(offset+token.length)))return token;
        if(token==='f'&&(/^[′']*\(/.test(text.slice(offset+token.length))||/F′\s*=\s*$/.test(text.slice(0,offset))))return token;
        if(token==='f'&&!isCode&&/(?:函数|数学记号|原式)\s*$/.test(text.slice(Math.max(0,offset-10),offset)))return token;
        return namedGroup(ctx,token)?.name??token;
      });
    }
    function normalize(doc,key){
      const ctx=contexts.get(key)??context(doc,key),mapValue=value=>{
        if(typeof value==='string')return scan(value,ctx);
        if(Array.isArray(value))return value.map(mapValue);
        if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,mapValue(item)]));
        return value;
      };
      const result=mapValue(doc),symbols=[],seen=new Set();
      if(doc.pairExamples)result.pairExamples=doc.pairExamples.map((entry,index)=>({...result.pairExamples[index],source:entry.source,expected:entry.expected,...(entry.compactSource?{compactSource:code(entry.compactSource,ctx)}:{})}));
      for(const symbol of doc.symbols){const group=ctx.resolve(symbol.name);if(seen.has(group.id))continue;seen.add(group.id);
        symbols.push({name:group.name,source:group.source,meaning:scan(symbol.meaning,ctx),uses:[...group.aliases]});
      }
      // The selected main function and any locally named teaching functions use
      // this same registry, rather than opening another private naming scheme.
      for(const group of ctx.resolved.values())if(!seen.has(group.id)){seen.add(group.id);symbols.push({name:group.name,source:group.source,meaning:scan(group.representative.symbol.meaning,ctx),uses:[...group.aliases]});}
      result.symbols=symbols;
      // These opening paragraphs teach syntax, where f is an arbitrary variable.
      result.basics=doc.basics.map(text=>text.startsWith('λx.body')||text.startsWith('f a b 按')||text.startsWith('箭头 →')?text:scan(text,ctx));
      result.featured=doc.featured?.map(name=>ctx.resolve(name)?.name??name);
      result.core=code(doc.core,ctx);result.foundation=code(doc.foundation,ctx);
      if(doc.compact)result.compact=code(doc.compact,ctx);
      result.steps=doc.steps.map(([title,explanation,expression,calculation])=>[scan(title,ctx),scan(explanation,ctx),expression===undefined?undefined:code(expression,ctx),calculation?mapValue(calculation):undefined]);
      result.walkthrough=code(doc.walkthrough,ctx);
      result.namingNote='函数名使用能看懂的小写简写，不限制字数：S组合子写作s，add、mul表示加法、乘法，pair构造序对，succ、pred表示后继、前驱，fac、fib表示迭代阶乘、斐波那契。较复杂的辅助函数保留完整含义；同一 λ 结构共用一个名称。局部变量尽量用单个小写字母，并避开函数名冲突。';
      result.displayTitle=scan(key,ctx);
      return result;
    }
    const sources=new Map();
    function source(text,key){
      if(sources.has(text))return sources.get(text);
      const ctx=contexts.get(key),lookup=name=>ctx?.resolve(name);
      const result=fragment(text,(term,literals)=>{
        const originalNames=new Set(),pending=[term];
        while(pending.length){const node=pending.pop();if(node.type==='var')originalNames.add(node.name);else if(node.type==='abs'){originalNames.add(node.param);pending.push(node.body);}else pending.push(node.fn,node.arg);}
        function walk(node,environment=new Map()){
          if(node.type==='var')return C.V(environment.get(node.name)?.name??node.name);
          if(node.type==='abs'){const names=new Map([...environment].map(([key,value])=>[key,value.name])),name=shortParameter(node.param,node.body,names,n=>lookup(n)?.name),scope=new Map(environment);scope.set(node.param,{name});return C.L(name,walk(node.body,scope));}
          if(node.fn.type==='abs'){
            const literalId=name=>{
              const raw=literals.get(name);if(!raw)return undefined;
              if(!/^[0-9]+(?:_(?:church|丘奇数))?$/.test(raw))return intern('literal:'+raw);
              return fingerprint(C.parse(raw.split('_')[0]),()=>undefined);
            };
            const id=fingerprint(node.arg,name=>literalId(name)??(environment.has(name)?environment.get(name).id??intern('outer:'+name):lookup(name)?.id));
            const group=groups.get(id),param=node.fn.param;
            let rename=group?.aliases.has(param)?group.name:shortParameter(param,node.fn.body,new Map([...environment].map(([key,value])=>[key,value.name])),n=>lookup(n)?.name);
            if(rename!==param){const occupied=new Set([...environment.values()].map(binding=>binding.name));while(occupied.has(rename)||originalNames.has(rename))rename+="'";}
            const scope=new Map(environment);scope.set(param,{name:rename,id});
            return C.A(C.L(rename,walk(node.fn.body,scope)),walk(node.arg,environment));
          }
          return C.A(walk(node.fn,environment),walk(node.arg,environment));
        }
        return walk(term);
      },true);
      sources.set(text,result);return result;
    }
    return {normalize,source,text:(text,key)=>scan(text,contexts.get(key)??{resolve:()=>undefined}),canonicalTerm:(term,key)=>renamed(term,contexts.get(key)),entries:()=>[...groups.values()].map(group=>({name:group.name,source:group.source,aliases:[...group.aliases]}))};
  }
  let shared;
  function catalog(){
    if(shared)return shared;
    const data=root.LambdaGuideNameData||require('./guide-name-data.js');
    return shared=create(data.lessons.map(lesson=>({key:lesson.key,doc:{symbols:lesson.symbols.map(index=>({...data.symbols[index],meaning:'统一辅助函数定义。'})),core:lesson.snippets[0],foundation:lesson.snippets[1],walkthrough:lesson.snippets[2],steps:lesson.snippets.slice(3).map(source=>[null,null,source])}})));
  }
  const API={create,catalog};root.LambdaGuideNames=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
