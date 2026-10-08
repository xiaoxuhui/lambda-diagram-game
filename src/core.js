(function (root) {
  'use strict';
  const LIMITS = Object.freeze({ chars: 1500, nodes: Infinity, depth: Infinity, steps: Infinity, nameChars:Infinity });
  const V = name => ({ type: 'var', name });
  const L = (param, body) => ({ type: 'abs', param, body });
  const A = (fn, arg) => ({ type: 'app', fn, arg });

  class LambdaError extends Error {
    constructor(message, position = null) { super(message); this.name = 'LambdaError'; this.position = position; }
  }
  function inspect(term) {
    let nodes = 0, depth = 0, vars = 0, abstractions = 0, applications = 0, nameChars = 0;
    const stack = [[term, 1]];
    while (stack.length) {
      const [t, d] = stack.pop(); nodes++; depth = Math.max(depth, d);
      if (t.type === 'var') { vars++; nameChars += t.name.length; }
      else if (t.type === 'abs') { abstractions++; nameChars += t.param.length; stack.push([t.body, d + 1]); }
      else { applications++; stack.push([t.fn, d + 1], [t.arg, d + 1]); }
    }
    return { nodes, depth, vars, abstractions, applications };
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
    if (t.type === 'var') return t.name;
    if (t.type === 'abs') {
      const s = `λ${t.param}.${format(t.body)}`;
      return context > 0 ? `(${s})` : s;
    }
    const s = `${format(t.fn, 1)} ${format(t.arg, 2)}`;
    return context > 1 ? `(${s})` : s;
  }
  function freeVars(t, bound = new Set(), out = new Set()) {
    if (t.type === 'var') { if (!bound.has(t.name)) out.add(t.name); }
    else if (t.type === 'abs') { const next = new Set(bound); next.add(t.param); freeVars(t.body, next, out); }
    else { freeVars(t.fn, bound, out); freeVars(t.arg, bound, out); }
    return out;
  }
  function allNames(t, out = new Set()) {
    if (t.type === 'var') out.add(t.name);
    else if (t.type === 'abs') { out.add(t.param); allNames(t.body, out); }
    else { allNames(t.fn, out); allNames(t.arg, out); }
    return out;
  }
  function renameBound(t, from, to) {
    if (t.type === 'var') return t.name === from ? V(to) : t;
    if (t.type === 'abs') return t.param === from ? t : L(t.param, renameBound(t.body, from, to));
    return A(renameBound(t.fn, from, to), renameBound(t.arg, from, to));
  }
  function substitute(t, name, argument) {
    const argFree = freeVars(argument), used = allNames(t, allNames(argument)); used.add(name);
    function sub(node) {
      if (node.type === 'var') return node.name === name ? argument : node;
      if (node.type === 'app') return A(sub(node.fn), sub(node.arg));
      if (node.param === name || !freeVars(node.body).has(name)) return node;
      let param = node.param, body = node.body;
      if (argFree.has(param)) {
        let i = 1; while (used.has(`${param}${i}`)) i++;
        const fresh = `${param}${i}`; used.add(fresh); body = renameBound(body, param, fresh); param = fresh;
      }
      return L(param, sub(body));
    }
    const result = sub(t); inspect(result); return result;
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
  const equal = (a, b) => key(a) === key(b);
  function findRedex(t, path = []) {
    if (t.type === 'app') {
      if (t.fn.type === 'abs') return { term: t, path };
      return findRedex(t.fn, [...path, 'fn']) || findRedex(t.arg, [...path, 'arg']);
    }
    if (t.type === 'abs') return findRedex(t.body, [...path, 'body']);
    return null;
  }
  function replaceAt(t, path, replacement, i = 0) {
    if (i === path.length) return replacement;
    const part = path[i];
    if (part === 'body') return L(t.param, replaceAt(t.body, path, replacement, i + 1));
    return part === 'fn' ? A(replaceAt(t.fn, path, replacement, i + 1), t.arg) : A(t.fn, replaceAt(t.arg, path, replacement, i + 1));
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
