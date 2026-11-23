(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  const {V,L,A}=C;
  const alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'";
  const legacyMarker=C.parse('λx.x x x x x x x');
  const marker=C.parse('λa b c d e f g.g f e d c b a');
  const successor=C.parse('λn f x.f (n f x)');
  const oldSuccessorExample=C.parse('succ 2 ((λn f x.n f (f x)) 2)');
  const numeral=n=>C.parse(String(n));
  const definitions=[
    ['yes','λa b.a'],
    ['no','λa b.b'],
    ['succ','λn f x.f (n f x)'],
    ['add','λm n f x.m f (n f x)'],
    ['pred','λn f x.n (λg h.h (g f)) (λu.x) (λu.u)'],
    ['zero','λn.n (λx.no) yes'],
    ['le','λm n.zero (n pred m)'],
    ['eq','λm n.le m n (le n m) no'],
    ['fix','λf.(λx.f (x x)) (λx.f (x x))'],
    ['bound','λi b f l a.b i'],
    ['freeTerm','λname b f l a.f name'],
    ['abs','λt b f l a.l t'],
    ['app','λp q b f l a.a p q'],
    // Shift indices at or beyond the cutoff when crossing binders.
    ['lift','fix (λwalk n cutoff t.t (λi.bound (le cutoff i (add n i) i)) (λname.freeTerm name) (λbody.abs (walk n (succ cutoff) body)) (λp q.app (walk n cutoff p) (walk n cutoff q)))'],
    // Remove one binder, lifting the argument past any intervening binders.
    ['subst','fix (λwalk arg depth t.t (λi.eq i depth (lift depth 0 arg) (bound (le depth i (pred i) i))) (λname.freeTerm name) (λbody.abs (walk arg (succ depth) body)) (λp q.app (walk arg depth p) (walk arg depth q)))'],
    ['head','fix (λwhnf t.t bound freeTerm abs (λp q.(λh.h (λi.app h q) (λname.app h q) (λbody.whnf (subst q 0 body)) (λf a.app h q)) (whnf p)))'],
    ['normalize','fix (λnf t.(head t) bound freeTerm (λbody.abs (nf body)) (λp q.app (nf p) (nf q)))']
  ];
  function makeProgram(functions,tag=marker){
    let term=C.parse('λinput result.result tag (normalize input)');
    for(const [name,source] of [...functions].reverse())term=A(L(name,term),C.parse(source));
    return A(L('tag',term),tag);
  }
  const legacyProgram=makeProgram(definitions,legacyMarker);
  const environmentDefinitions=[
    ...definitions.filter(([name])=>['succ','pred','fix','bound','freeTerm','abs','app'].includes(name)),
    ['nil','λnext end.end'],
    ['cons','λvalue rest next end.next value rest'],
    ['get','λindex env.index (λxs.xs (λvalue rest.rest) nil) env (λvalue rest.value) nil'],
    // Evaluate to closures or neutral terms, then quote closures back to syntax.
    ['closure','λbody l n.l body'],
    ['neutral','λterm l n.n term'],
    ['reify','fix (λquote value depth.value (λbody.abs (quote (body (neutral (λd.bound (pred (depth pred d))))) (succ depth))) (λterm.term depth))'],
    ['evalTerm','fix (λeval env term.term (λi.get i env) (λname.neutral (λdepth.freeTerm name)) (λbody.closure (λvalue.eval (cons value env) body)) (λp q.(eval env p) (λbody.body (eval env q)) (λterm.neutral (λdepth.app (term depth) (reify (eval env q) depth)))))'],
    ['normalize','λterm.reify (evalTerm nil term) 0']
  ];
  const previousProgram=makeProgram(environmentDefinitions,legacyMarker);
  // Select a branch before supplying its environment or evaluated argument.
  // The unselected branch then disappears before it can duplicate either value.
  const factoredDefinitions={
    reify:'fix (λquote value depth.value (λbody depth.abs (quote (body (neutral (λd.bound (pred (depth pred d))))) (succ depth))) (λterm.term) depth)',
    evalTerm:'fix (λeval env term.term get (λname env.neutral (λdepth.freeTerm name)) (λbody env.closure (λvalue.eval (cons value env) body)) (λp q env.(eval env p) (λbody.body) (λterm argument.neutral (λdepth.app (term depth) (reify argument depth))) (eval env q)) env)'
  };
  const evaluatorDefinitions=environmentDefinitions.map(([name,source])=>[name,factoredDefinitions[name]??source]);
  const taggedProgram=makeProgram(evaluatorDefinitions);
  const pipelineMarker=C.parse('λa b c d e f g h.h g f e d c b a');
  const decoderDefinition='λfreeenv.fix (λdecode env term.term (λi.get i env) (λi.get i freeenv) (λbody.λx0.decode (cons x0 env) body) (λp q.(decode env p) (decode env q)))';
  const pipelineDefinitions=[...evaluatorDefinitions,['decode',decoderDefinition]];
  const legacyMainSource='λfreeenv input.decode freeenv nil (normalize input)';
  const mainSource='λinput.input (λfreeenv.λsyntax.decode freeenv nil (normalize syntax))';
  let pipelineBody=C.parse(legacyMainSource);
  for(const [name,source] of [...pipelineDefinitions].reverse())pipelineBody=A(L(name,pipelineBody),C.parse(source));
  const program=A(L('pipelineTag',pipelineBody),pipelineMarker);

  function variant(index,fields){
    const params=['boundCase','freeCase','absCase','appCase'];
    const body=fields.reduce(A,V(params[index]));
    return params.reduceRight((term,param)=>L(param,term),body);
  }
  function encodeName(name){
    const codes=[...name].every(character=>alphabet.includes(character))
      ?[...name].map(character=>alphabet.indexOf(character))
      :[alphabet.length,...new TextEncoder().encode(name)];
    const body=codes.reduceRight((tail,code)=>
      A(A(V('c'),numeral(code)),tail),V('n'));
    return L('c',L('n',body));
  }
  function quote(term,freeIndices=null){
    const scope=[],pending=[{term}],quoted=[];
    while(pending.length){
      const entry=pending.pop(),node=entry.term;
      if(entry.finish==='abs'){scope.pop();quoted.push(variant(2,[quoted.pop()]));}
      else if(entry.finish==='app'){const arg=quoted.pop();quoted.push(variant(3,[quoted.pop(),arg]));}
      else if(node.type==='var'){
        const index=scope.lastIndexOf(node.name);
        quoted.push(index<0?variant(1,[freeIndices?numeral(freeIndices.get(node.name)):encodeName(node.name)]):variant(0,[numeral(scope.length-1-index)]));
      }else if(node.type==='abs'){
        scope.push(node.param);pending.push({finish:'abs'},{term:node.body});
      }else pending.push({finish:'app'},{term:node.arg},{term:node.fn});
    }
    return quoted[0];
  }
  function compileTerm(term,expand=term=>term){
    const restored=unwrap(term);
    const input=restored?expandInput(restored,expand):expand(term),names=[...C.freeVars(input)].sort(),indices=new Map(names.map((name,index)=>[name,index]));
    const used=new Set(names),fresh=base=>{let name=base;while(used.has(name))name+="'";used.add(name);return name;};
    const next=fresh('next'),end=fresh('end');let freeenv=L(next,L(end,V(end)));
    for(const name of [...names].reverse())freeenv=L(next,L(end,A(A(V(next),V(name)),freeenv)));
    return A(A(program,freeenv),quote(input,indices));
  }

  function unwrap(term){
    const {head,args}=application(term);
    if(args.length>=3&&C.equal(args[0],pipelineMarker)&&C.equal(head,program.fn)){
      const values=readEnvironment(args[1]),original=values&&unquote(args[2],values);
      if(original)return {term:args.slice(3).reduce(A,original),legacy:false,previous:false,trailing:args.length>3,pipeline:true};
      return null;
    }
    if(args.length>=2){
      const oldTag=C.equal(args[0],legacyMarker);
      const legacy=oldTag&&C.equal(head,legacyProgram.fn);
      const previous=oldTag&&C.equal(head,previousProgram.fn);
      const tagged=C.equal(args[0],marker)&&C.equal(head,taggedProgram.fn);
      if(!legacy&&!previous&&!tagged)return null;
      const original=unquote(args[1]);
      if(original)return {term:args.slice(2).reduce(A,original),legacy,previous,trailing:args.length>2,tagged};
    }
    return null;
  }
  function expandInput(restored,expand){
    const term=expand(restored.term);
    // Recover the pasted successor example without reserving a function name.
    return restored.legacy&&C.equal(restored.term,oldSuccessorExample)&&C.freeVars(term).has('succ')
      ?C.substitute(term,'succ',successor):term;
  }

  function application(term){
    const args=[];
    for(;term.type==='app';term=term.fn)args.push(term.arg);
    return {head:term,args:args.reverse()};
  }
  const pipelineTags=new WeakMap();
  function isPipeline(term){
    if(!term)return false;
    if(pipelineTags.has(term))return pipelineTags.get(term);
    const pending=[term],seen=new WeakSet();let found=false;
    while(pending.length){const node=pending.pop();if(seen.has(node))continue;seen.add(node);
      if(node.type==='abs')pending.push(node.body);
      else if(node.type==='app'){
        if(node.fn.type==='abs'&&C.equal(node.arg,pipelineMarker)&&!C.freeVars(node.fn.body).has(node.fn.param)){found=true;break;}
        pending.push(node.fn,node.arg);
      }
    }
    pipelineTags.set(term,found);return found;
  }
  function readName(term){
    if(term.type!=='abs'||term.body.type!=='abs'||term.param===term.body.param)return null;
    const cons=term.param,nil=term.body.param;
    const codes=[];let body=term.body.body;
    while(body.type==='app'&&body.fn.type==='app'&&body.fn.fn.type==='var'&&body.fn.fn.name===cons){
      const code=C.churchNumber(body.fn.arg);
      if(code===null||code>255)return null;
      codes.push(code);body=body.arg;
    }
    if(body.type!=='var'||body.name!==nil)return null;
    let name;
    if(codes[0]===alphabet.length){try{name=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(codes.slice(1)));}catch{return null;}}
    else {if(codes.some(code=>code>=alphabet.length))return null;name=codes.map(code=>alphabet[code]).join('');}
    return C.validName(name)?name:null;
  }
  function readTerm(term){
    if(term.type!=='abs')return null;
    const {head,args}=application(term.body);
    if(head.type!=='var'||head.name!==term.param||args.length!==2||!C.equal(args[0],marker)&&!C.equal(args[0],legacyMarker))return null;
    return unquote(args[1]);
  }
  function readEnvironment(term){
    const values=[];
    while(term?.type==='abs'&&term.body.type==='abs'){
      const body=term.body.body;if(body.type==='var'&&body.name===term.body.param)return values;
      if(body.type!=='app'||body.fn.type!=='app'||body.fn.fn.type!=='var'||body.fn.fn.name!==term.param)return null;
      values.push(body.fn.arg);term=body.arg;
    }
    return null;
  }
  function unquote(term,freeValues=null){
    const pending=[{term,depth:0}],nodes=[],free=new Set();
    while(pending.length){
      const entry=pending.pop();
      if(entry.finish==='abs'){nodes.push({type:'abs',body:nodes.pop()});continue;}
      if(entry.finish==='app'){const arg=nodes.pop();nodes.push({type:'app',fn:nodes.pop(),arg});continue;}
      const params=[];let body=entry.term;
      for(let i=0;i<4;i++){
        if(body.type!=='abs')return null;
        params.push(body.param);body=body.body;
      }
      const {head,args}=application(body);
      const index=head.type==='var'?params.lastIndexOf(head.name):-1;
      if(index<0||args.length!==(index===3?2:1))return null;
      if(index===0){
        const value=C.churchNumber(args[0]);
        if(value===null||value>=entry.depth)return null;
        nodes.push({type:'bound',index:value});
      }else if(index===1){
        if(freeValues){
          const index=C.churchNumber(args[0]);if(index===null||index>=freeValues.length)return null;
          const value=freeValues[index];for(const name of C.freeVars(value))free.add(name);nodes.push({type:'native',term:value});
        }else{
          const name=readName(args[0]);if(name===null)return null;free.add(name);nodes.push(V(name));
        }
      }else if(index===2){
        pending.push({finish:'abs'},{term:args[0],depth:entry.depth+1});
      }else pending.push({finish:'app'},{term:args[1],depth:entry.depth},{term:args[0],depth:entry.depth});
    }
    return named(nodes[0],free);
  }
  function named(term,free){
    const scope=[],pending=[{term}],result=[];
    let next=0;
    while(pending.length){
      const entry=pending.pop(),node=entry.term;
      if(entry.finish==='abs')result.push(L(scope.pop(),result.pop()));
      else if(entry.finish==='app'){const arg=result.pop();result.push(A(result.pop(),arg));}
      else if(node.type==='bound')result.push(V(scope[scope.length-1-node.index]));
      else if(node.type==='var')result.push(node);
      else if(node.type==='native')result.push(node.term);
      else if(node.type==='abs'){
        let name;
        do{name='x'+next++;}while(free.has(name));
        scope.push(name);pending.push({finish:'abs'},{term:node.body});
      }else pending.push({finish:'app'},{term:node.arg},{term:node.fn});
    }
    return result[0];
  }
  const API={compile:(source,expand)=>C.format(compileTerm(C.parse(source),expand)),compileTerm,readTerm,
    read:term=>{const decoded=readTerm(term);return decoded?C.format(decoded):null;},
    sourceOf:source=>{const restored=unwrap(C.parse(source));return restored?C.format(restored.term):source;},
    isProgram:term=>{
      const {head,args}=application(term);
      return isPipeline(term)||args.length===2&&C.equal(args[0],marker)&&C.equal(head,taggedProgram.fn);
    },
    isPipeline,
    definitions:pipelineDefinitions.map(([name,source])=>({name,source})),mainSource,legacyMainSource,
    stages:term=>{const expression=compileTerm(term);return {input:term,freeEnvironment:expression.fn.arg,encoded:expression.arg,expression};},
    needsRepair:term=>{const restored=unwrap(term);return !!(restored&&(restored.legacy||restored.previous||restored.tagged||restored.trailing));},
    repair:(term,expand=term=>term)=>{
      const restored=unwrap(term);
      if(!restored)return term;
      const input=expandInput(restored,expand);
      return restored.legacy||restored.previous||restored.tagged||restored.trailing||!C.equal(input,restored.term)?compileTerm(input):term;
    }
  };
  root.LambdaMeta=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
