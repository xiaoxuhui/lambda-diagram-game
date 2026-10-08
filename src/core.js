(function (root) {
  'use strict';
  const LIMITS = Object.freeze({ chars: 1500, nodes: 4000, depth: 300, steps: 200 });
  const V = name => ({ type: 'var', name });
  const L = (param, body) => ({ type: 'abs', param, body });
  const A = (fn, arg) => ({ type: 'app', fn, arg });

  class LambdaError extends Error {
    constructor(message, position = null) { super(message); this.name = 'LambdaError'; this.position = position; }
  }
  function inspect(term) {
    let nodes = 0, depth = 0, vars = 0, abstractions = 0, applications = 0;
    const stack = [[term, 1]];
    while (stack.length) {
      const [t, d] = stack.pop(); nodes++; depth = Math.max(depth, d);
      if (nodes > LIMITS.nodes) throw new LambdaError(`表达式超过 ${LIMITS.nodes} 个节点，请缩小表达式。`);
      if (d > LIMITS.depth) throw new LambdaError(`嵌套超过 ${LIMITS.depth} 层，请简化表达式。`);
      if (t.type === 'var') vars++;
      else if (t.type === 'abs') { abstractions++; stack.push([t.body, d + 1]); }
      else { applications++; stack.push([t.fn, d + 1], [t.arg, d + 1]); }
    }
    return { nodes, depth, vars, abstractions, applications };
  }
  function tokenize(source) {
    if (source.length > LIMITS.chars) throw new LambdaError(`输入最多 ${LIMITS.chars} 个字符。`, LIMITS.chars);
    const out = [];
    for (let i = 0; i < source.length;) {
      if (/\s/.test(source[i])) { i++; continue; }
      const start = i, c = source[i];
      if ('λ\\.()'.includes(c)) { out.push({ kind: c === '\\' ? 'λ' : c, pos: i++ }); continue; }
      const m = /^[a-zA-Z][a-zA-Z0-9_']*/.exec(source.slice(i));
      if (m) { out.push({ kind: 'name', value: m[0], pos: start }); i += m[0].length; continue; }
      throw new LambdaError(`无法识别「${c}」，变量请用英文字母开头。`, i);
    }
    out.push({ kind: 'end', pos: source.length }); return out;
  }
  function parse(source) {
    const tokens = tokenize(source); let at = 0, nesting = 0;
    const peek = () => tokens[at];
    const fail = message => { throw new LambdaError(message, peek().pos); };
    function expr() {
      if (++nesting > LIMITS.depth) fail(`嵌套超过 ${LIMITS.depth} 层。`);
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
        while (peek().kind === 'name' || peek().kind === '(') result = A(result, atom());
        if (peek().kind === 'λ') fail('作为参数的 λ 表达式需要括号，例如 f (λx.x)。');
      }
      nesting--; return result;
    }
    function atom() {
      if (peek().kind === 'name') return V(tokens[at++].value);
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
    const argSize = inspect(argument).nodes; let cost = 0;
    function charge(n = 1) {
      cost += n;
      if (cost > LIMITS.nodes) throw new LambdaError(`这一步会超过 ${LIMITS.nodes} 个节点，已暂停。`);
    }
    function sub(node) {
      if (node.type === 'var') { charge(node.name === name ? argSize : 1); return node.name === name ? argument : node; }
      if (node.type === 'app') { charge(); return A(sub(node.fn), sub(node.arg)); }
      if (node.param === name || !freeVars(node.body).has(name)) { charge(inspect(node).nodes); return node; }
      charge(); let param = node.param, body = node.body;
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
