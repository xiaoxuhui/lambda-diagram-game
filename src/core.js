(function (root) {
  'use strict';
  const LIMITS = Object.freeze({ chars: 1500, nodes: Infinity, depth: Infinity, steps: Infinity, nameChars:Infinity });
  const V = name => Object.freeze({ type: 'var', name });
  const L = (param, body) => Object.freeze({ type: 'abs', param, body });
  const A = (fn, arg) => Object.freeze({ type: 'app', fn, arg });
  const facts=new WeakMap(),formatted=new WeakMap(),freeSets=new WeakMap(),occurrences=new WeakMap();

  class LambdaError extends Error {
    constructor(message, position = null) { super(message); this.name = 'LambdaError'; this.position = position; }
  }
  function analyze(term) {
    if(facts.has(term))return facts.get(term);
    const local=new WeakMap(),get=t=>facts.get(t)||local.get(t),stack=[[term,false]];
    while(stack.length){
      const [t,done]=stack.pop();if(get(t))continue;
      if(!done&&t.type!=='var'){stack.push([t,true]);if(t.type==='abs')stack.push([t.body,false]);else stack.push([t.arg,false],[t.fn,false]);continue;}
      let f;
      if(t.type==='var')f={nodes:1,depth:1,vars:1,abstractions:0,applications:0,redex:false,stable:Object.isFrozen(t)};
      else if(t.type==='abs'){const b=get(t.body);f={nodes:1+b.nodes,depth:1+b.depth,vars:b.vars,abstractions:1+b.abstractions,applications:b.applications,redex:b.redex,stable:Object.isFrozen(t)&&b.stable};}
      else{const a=get(t.fn),b=get(t.arg);f={nodes:1+a.nodes+b.nodes,depth:1+Math.max(a.depth,b.depth),vars:a.vars+b.vars,abstractions:a.abstractions+b.abstractions,applications:1+a.applications+b.applications,redex:t.fn.type==='abs'||a.redex||b.redex,stable:Object.isFrozen(t)&&a.stable&&b.stable};}
      if(f.stable)facts.set(t,f);else local.set(t,f);
    }
    return get(term);
  }
  function inspect(term) {
    const {nodes,depth,vars,abstractions,applications}=analyze(term);
    return {nodes,depth,vars,abstractions,applications};
  }
  function tokenize(source, maxChars = LIMITS.chars) {
    if (source.length > maxChars) throw new LambdaError(`输入最多 ${maxChars} 个字符。`, maxChars);
    const out = [];
    for (let i = 0; i < source.length;) {
      if (/\s/.test(source[i])) { i++; continue; }
      const start = i, c = source[i];
      if ('λ\\.()'.includes(c)) { out.push({ kind: c === '\\' ? 'λ' : c, pos: i++ }); continue; }
      if(c==='-' && /[0-9]/.test(source[i+1]||'')) throw new LambdaError('丘奇数只支持非负整数，不能输入负数。',i);
      const numeric=/^[0-9]+/.exec(source.slice(i));
      if(numeric) {
        if(source[i+numeric[0].length]==='.') throw new LambdaError('丘奇数只支持非负整数，不能输入小数。',i);
        const value=Number(numeric[0]);
        if(!Number.isSafeInteger(value)) throw new LambdaError('数字超出可精确表示的整数范围。',i);
        out.push({kind:'number',value,pos:i});i+=numeric[0].length;continue;
      }
      const m = /^[a-zA-Z][a-zA-Z0-9_']*/.exec(source.slice(i));
      if (m) { out.push({ kind: 'name', value: m[0], pos: start }); i += m[0].length; continue; }
      throw new LambdaError(`无法识别「${c}」，变量请用英文字母开头。`, i);
    }
    out.push({ kind: 'end', pos: source.length }); return out;
  }
  function parse(source, maxChars = LIMITS.chars) {
    const tokens = tokenize(source, maxChars); let at = 0, nesting = 0;
    const peek = () => tokens[at];
    const fail = message => { throw new LambdaError(message, peek().pos); };
    function expr() {
      ++nesting;
      let result;
      if (peek().kind === 'λ') {
        at++; const params = [];
        while (peek().kind === 'name') params.push(tokens[at++].value);
        if (!params.length) fail('λ 后面需要一个变量，例如 λx.x。');
        if (peek().kind !== '.') fail('变量后面需要一个点「.」。');
        at++; result = expr();
        for (let i = params.length - 1; i >= 0; i--) result = L(params[i], result);
      } else {
        result = atom();
        while (peek().kind === 'name' || peek().kind === 'number' || peek().kind === '(') result = A(result, atom());
        if (peek().kind === 'λ') fail('作为参数的 λ 表达式需要括号，例如 f (λx.x)。');
      }
      nesting--; return result;
    }
    function atom() {
      if (peek().kind === 'name') return V(tokens[at++].value);
      if (peek().kind === 'number') {
        const n=tokens[at++].value;let body=V('x');
        for(let i=0;i<n;i++)body=A(V('f'),body);
        return L('f',L('x',body));
      }
      if (peek().kind === '(') {
        at++; const t = expr();
        if (peek().kind !== ')') fail('缺少右括号「)」。');
        at++; return t;
      }
      fail(peek().kind === 'end' ? '这里需要一个表达式。' : '这里需要变量或括号内的表达式。');
    }
    if (peek().kind === 'end') fail('先写一个 Lambda 表达式，或选一个示例。');
    const t = expr();
    if (peek().kind !== 'end') fail('多余的符号或右括号。');
    inspect(t); return t;
  }
  function format(t, context = 0) {
    let text=formatted.get(t);
    if(text===undefined){
      const parts=[],stack=[[t,0]];
      while(stack.length){const entry=stack.pop();if(typeof entry==='string'){parts.push(entry);continue;}
        const [node,ctx]=entry,brackets=node.type==='abs'?ctx>0:node.type==='app'&&ctx>1;
        if(brackets){parts.push('(');stack.push(')');}
        if(node.type==='var')parts.push(node.name);
        else if(node.type==='abs'){parts.push(`λ${node.param}.`);stack.push([node.body,0]);}
        else stack.push([node.arg,2],' ',[node.fn,1]);
      }
      text=parts.join('');if(analyze(t).stable)formatted.set(t,text);
    }
    return (t.type==='abs'&&context>0)||(t.type==='app'&&context>1)?`(${text})`:text;
  }
  function freeVars(t, bound = new Set(), out = new Set()) {
    let found=freeSets.get(t);
    if(!found){found=new Set();const bindings=new Map(),stack=[[t,false]];
      while(stack.length){const [node,exit]=stack.pop();
        if(exit){const count=bindings.get(node.param)-1;if(count)bindings.set(node.param,count);else bindings.delete(node.param);continue;}
        if(node.type==='var'){if(!bindings.has(node.name))found.add(node.name);}
        else if(node.type==='abs'){bindings.set(node.param,(bindings.get(node.param)||0)+1);stack.push([node,true],[node.body,false]);}
        else stack.push([node.arg,false],[node.fn,false]);
      }
      if(analyze(t).stable)freeSets.set(t,found);
    }
    for(const name of found)if(!bound.has(name))out.add(name);
    return out;
  }
  function allNames(t, out = new Set()) {
    const visited=new WeakSet(),stack=[t];while(stack.length){const node=stack.pop();if(visited.has(node))continue;visited.add(node);
      if(node.type==='var')out.add(node.name);else if(node.type==='abs'){out.add(node.param);stack.push(node.body);}else stack.push(node.arg,node.fn);
    }
    return out;
  }
  function hasFree(t,name) {
    const local=new WeakMap(),read=node=>occurrences.get(node)?.get(name)??local.get(node),stack=[[t,false]];
    while(stack.length){const [node,done]=stack.pop();if(read(node)!==undefined)continue;
      let value;
      if(node.type==='var')value=node.name===name;
      else if(node.type==='abs'&&node.param===name)value=false;
      else if(!done){stack.push([node,true]);if(node.type==='abs')stack.push([node.body,false]);else stack.push([node.arg,false],[node.fn,false]);continue;}
      else value=node.type==='abs'?read(node.body):read(node.fn)||read(node.arg);
      if(analyze(node).stable){let names=occurrences.get(node);if(!names){names=new Map();occurrences.set(node,names);}names.set(name,value);}else local.set(node,value);
    }
    return read(t);
  }
  function renameBound(t, from, to) {
    return rewrite(t,from,V(to),false);
  }
  function rewrite(t,name,argument,avoidCapture) {
    if(!hasFree(t,name))return t;
    const argFree=avoidCapture?freeVars(argument):new Set(),results=new WeakMap(),stack=[{node:t}],original=t;let used;
    while(stack.length){const entry=stack.pop(),node=entry.node;if(results.has(node))continue;
      if(!entry.done){
        if(!hasFree(node,name)){results.set(node,node);continue;}
        if(node.type==='var'){results.set(node,argument);continue;}
        if(node.type==='app'){stack.push({node,done:true},{node:node.arg},{node:node.fn});continue;}
        let param=node.param,body=node.body;
        if(argFree.has(param)){
          if(!used){used=allNames(original,allNames(argument));used.add(name);}
          let i=1;while(used.has(`${param}${i}`))i++;
          const fresh=`${param}${i}`;used.add(fresh);body=renameBound(body,param,fresh);param=fresh;
        }
        stack.push({node,done:true,param,body},{node:body});
      }else if(node.type==='app'){
        const fn=results.get(node.fn),arg=results.get(node.arg);results.set(node,fn===node.fn&&arg===node.arg?node:A(fn,arg));
      }else{const body=results.get(entry.body);results.set(node,entry.param===node.param&&body===node.body?node:L(entry.param,body));}
    }
    return results.get(t);
  }
  function substitute(t, name, argument) {
    const result=rewrite(t,name,argument,true);inspect(result);return result;
  }
  function alphaKey(t, env = []) {
    if (t.type === 'var') {
      const i = env.lastIndexOf(t.name);
      return i < 0 ? ['free', t.name] : ['bound', env.length - 1 - i];
    }
    if (t.type === 'abs') return ['abs', alphaKey(t.body, [...env, t.param])];
    return ['app', alphaKey(t.fn, env), alphaKey(t.arg, env)];
  }
  const key = t => JSON.stringify(alphaKey(t));
  function equal(a,b) {
    if(a===b)return true;
    const left=new Map(),right=new Map(),stack=[{a,b}],push=(map,name,id)=>{const list=map.get(name)||[];list.push(id);map.set(name,list);};let id=0;
    while(stack.length){const entry=stack.pop(),x=entry.a,y=entry.b;
      if(entry.exit){left.get(x.param).pop();right.get(y.param).pop();continue;}
      if(x.type!==y.type)return false;
      if(x.type==='var'){const l=left.get(x.name)?.at(-1),r=right.get(y.name)?.at(-1);if(l!==undefined||r!==undefined){if(l!==r)return false;}else if(x.name!==y.name)return false;}
      else if(x.type==='abs'){push(left,x.param,++id);push(right,y.param,id);stack.push({a:x,b:y,exit:true},{a:x.body,b:y.body});}
      else stack.push({a:x.arg,b:y.arg},{a:x.fn,b:y.fn});
    }
    return true;
  }
  function findRedex(t, path = []) {
    const route=[...path];
    while(true){
      if(t.type==='app'&&t.fn.type==='abs')return {term:t,path:route};
      if(!analyze(t).redex)return null;
      if(t.type==='abs'){route.push('body');t=t.body;}
      else if(analyze(t.fn).redex){route.push('fn');t=t.fn;}
      else{route.push('arg');t=t.arg;}
    }
  }
  function replaceAt(t, path, replacement, i = 0) {
    const parents=[];for(;i<path.length;i++){const part=path[i];parents.push([t,part]);t=t[part];}
    for(let j=parents.length-1;j>=0;j--){const [parent,part]=parents[j];replacement=part==='body'?L(parent.param,replacement):part==='fn'?A(replacement,parent.arg):A(parent.fn,replacement);}
    return replacement;
  }
  function step(t) {
    const redex = findRedex(t); if (!redex) return null;
    const { fn, arg } = redex.term;
    const replacement = substitute(fn.body, fn.param, arg);
    const result = replaceAt(t, redex.path, replacement); inspect(result);
    return { term: result, path: redex.path, before: redex.term, replacement, param: fn.param, argument: arg };
  }
  function normalize(t, max = LIMITS.steps) {
    const seen = new Set([key(t)]); let steps = 0;
    while (steps < max) {
      const s = step(t); if (!s) return { term: t, steps, status: 'normal' };
      t = s.term; steps++; const k = key(t);
      if (seen.has(k)) return { term: t, steps, status: 'cycle' };
      seen.add(k);
    }
    return { term: t, steps, status: findRedex(t) ? 'limit' : 'normal' };
  }
  function churchNumber(t) {
    if (t.type !== 'abs' || t.body.type !== 'abs' || t.param === t.body.param) return null;
    const f = t.param, x = t.body.param; let body = t.body.body, n = 0;
    while (body.type === 'app' && body.fn.type === 'var' && body.fn.name === f) { n++; body = body.arg; }
    return body.type === 'var' && body.name === x ? n : null;
  }
  const API = { LIMITS, LambdaError, V, L, A, parse, format, inspect, freeVars, substitute, alphaKey, key, equal, findRedex, step, normalize, churchNumber };
  root.LambdaCore = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : window);
