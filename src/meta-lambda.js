(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  const {V,L,A}=C;
  const alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'";
  const marker=C.parse('λx.x x x x x x x');
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
  function makeProgram(functions){
    let term=C.parse('λinput result.result tag (normalize input)');
    for(const [name,source] of [...functions].reverse())term=A(L(name,term),C.parse(source));
    return A(L('tag',term),marker);
  }
  const legacyProgram=makeProgram(definitions);
  const program=makeProgram([
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
  ]);

  function variant(index,fields){
    const params=['boundCase','freeCase','absCase','appCase'];
    const body=fields.reduce(A,V(params[index]));
    return params.reduceRight((term,param)=>L(param,term),body);
  }
  function encodeName(name){
    const body=[...name].reduceRight((tail,character)=>
      A(A(V('c'),numeral(alphabet.indexOf(character))),tail),V('n'));
    return L('c',L('n',body));
  }
  function quote(term){
    const scope=[],pending=[{term}],quoted=[];
    while(pending.length){
      const entry=pending.pop(),node=entry.term;
      if(entry.finish==='abs'){scope.pop();quoted.push(variant(2,[quoted.pop()]));}
      else if(entry.finish==='app'){const arg=quoted.pop();quoted.push(variant(3,[quoted.pop(),arg]));}
      else if(node.type==='var'){
        const index=scope.lastIndexOf(node.name);
        quoted.push(index<0?variant(1,[encodeName(node.name)]):variant(0,[numeral(scope.length-1-index)]));
      }else if(node.type==='abs'){
        scope.push(node.param);pending.push({finish:'abs'},{term:node.body});
      }else pending.push({finish:'app'},{term:node.arg},{term:node.fn});
    }
    return quoted[0];
  }
  function compile(source,expand=term=>term){
    const term=C.parse(source);
    const restored=unwrap(term);
    return C.format(A(program,quote(restored?expandInput(restored,expand):expand(term))));
  }

  function unwrap(term){
    const {head,args}=application(term);
    if(args.length>=2&&C.equal(args[0],marker)){
      const legacy=C.equal(head,legacyProgram.fn);
      if(!legacy&&!C.equal(head,program.fn))return null;
      const original=unquote(args[1]);
      if(original)return {term:args.slice(2).reduce(A,original),legacy,trailing:args.length>2};
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
  function readName(term){
    if(term.type!=='abs'||term.body.type!=='abs'||term.param===term.body.param)return null;
    const cons=term.param,nil=term.body.param;
    let name='',body=term.body.body;
    while(body.type==='app'&&body.fn.type==='app'&&body.fn.fn.type==='var'&&body.fn.fn.name===cons){
      const code=C.churchNumber(body.fn.arg);
      if(code===null||code>=alphabet.length)return null;
      name+=alphabet[code];body=body.arg;
    }
    return body.type==='var'&&body.name===nil&&/^[A-Za-z][A-Za-z0-9_']*$/.test(name)?name:null;
  }
  function read(term){
    if(term.type!=='abs')return null;
    const {head,args}=application(term.body);
    if(head.type!=='var'||head.name!==term.param||args.length!==2||!C.equal(args[0],marker))return null;
    const decoded=unquote(args[1]);
    return decoded?C.format(decoded):null;
  }
  function unquote(term){
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
        const name=readName(args[0]);
        if(name===null)return null;
        free.add(name);nodes.push(V(name));
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
      else if(node.type==='abs'){
        let name;
        do{name='x'+next++;}while(free.has(name));
        scope.push(name);pending.push({finish:'abs'},{term:node.body});
      }else pending.push({finish:'app'},{term:node.arg},{term:node.fn});
    }
    return result[0];
  }
  const API={compile,read,
    sourceOf:source=>{const restored=unwrap(C.parse(source));return restored?C.format(restored.term):source;},
    isProgram:term=>{
      const {head,args}=application(term);
      return args.length===2&&C.equal(args[0],marker)&&C.equal(head,program.fn);
    },
    needsRepair:term=>{const restored=unwrap(term);return !!(restored&&(restored.legacy||restored.trailing));},
    repair:(term,expand=term=>term)=>{
      const restored=unwrap(term);
      return restored&&(restored.legacy||restored.trailing)?A(program,quote(expandInput(restored,expand))):term;
    }
  };
  root.LambdaMeta=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
