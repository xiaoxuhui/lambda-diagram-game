const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');
const p = C.parse;
const normal = s => C.normalize(p(s));

test('λ and backslash are interchangeable', () => assert.ok(C.equal(p('λx.x'), p('\\x.x'))));
test('multi-parameter abstraction expands', () => assert.ok(C.equal(p('λx y.x'), p('λa.λb.a'))));
test('application is left associative', () => assert.deepEqual(p('a b c'), C.A(C.A(C.V('a'), C.V('b')), C.V('c'))));
test('lambda extends right', () => assert.deepEqual(p('λx.x y'), C.L('x', C.A(C.V('x'), C.V('y')))));
test('long variable names are not split', () => assert.equal(p('xy').name, 'xy'));
test('format roundtrips nested application and abstraction', () => {
  for (const s of ['λx.x', 'λx y.x (y x)', '(λx.x) (λy.y)', 'a (b c)', '(λx.x x) (λx.x x)'])
    assert.deepEqual(p(C.format(p(s))), p(s));
});
test('empty input has a located error', () => assert.throws(() => p('  '), e => e.position === 2));
test('missing dot is rejected', () => assert.throws(() => p('λx x'), /一个点/));
test('missing binder is rejected', () => assert.throws(() => p('λ.x'), /一个变量/));
test('missing parenthesis is rejected', () => assert.throws(() => p('(λx.x'), /右括号/));
test('extra parenthesis is rejected', () => assert.throws(() => p('x)'), /多余/));
test('illegal token is located', () => assert.throws(() => p('x + y'), e => e.position === 2));
test('naked lambda argument is rejected with help', () => assert.throws(() => p('f λx.x'), /需要括号/));
test('character budget rejects before parse', () => assert.throws(() => p('x'.repeat(1501)), /1500/));
test('parenthesis depth budget avoids stack overflow', () => assert.throws(() => p('('.repeat(301) + 'x' + ')'.repeat(301)), /嵌套/));
test('application depth budget is enforced', () => assert.throws(() => p(Array(302).fill('x').join(' ')), /嵌套/));
test('identity reduces in one step', () => assert.ok(C.equal(C.step(p('(λx.x)(λy.y)')).term, p('λy.y'))));
test('capture avoidance preserves free argument', () => {
  const t = C.step(p('(λx.λy.x) y')).term;
  assert.deepEqual([...C.freeVars(t)], ['y']); assert.ok(C.equal(t, p('λz.y'))); assert.notEqual(t.param, 'y');
});
test('fresh names avoid existing names', () => assert.ok(C.equal(C.step(p('(λx.λy.x y1) y')).term, p('λz.y y1'))));
test('shadowed binder blocks substitution', () => assert.ok(C.equal(C.step(p('(λx.λx.x) y')).term, p('λx.x'))));
test('nested same-name binding is renamed only in scope', () => assert.ok(C.equal(C.step(p('(λx.λy.x (λy.y)) y')).term, p('λz.y (λy.y)'))));
test('normal order discards divergent unused argument', () => {
  const r = normal('(λx.λy.y) ((λx.x x)(λx.x x))'); assert.equal(r.status, 'normal'); assert.equal(r.steps, 1);
});
test('normal order reduces inside abstractions', () => assert.equal(C.format(normal('λz.(λx.x) z').term), 'λz.z'));
test('omega is identified as repeated state', () => assert.equal(normal('(λx.x x)(λx.x x)').status, 'cycle'));
test('SKK acts as identity', () => {
  const r = normal('(λx y z.(x z)(y z)) (λa b.a) (λa b.a)');
  assert.equal(r.status, 'normal'); assert.ok(C.equal(r.term, p('λx.x')));
});
test('Church addition computes 2 + 3 = 5', () => {
  const r = normal('(λm n f x.m f (n f x)) (λf x.f (f x)) (λf x.f (f (f x)))');
  assert.equal(r.status, 'normal'); assert.equal(C.churchNumber(r.term), 5);
});
test('Church multiplication computes 2 × 3 = 6', () => {
  const r = normal('(λm n f.m (n f)) (λf x.f (f x)) (λf x.f (f (f x)))');
  assert.equal(C.churchNumber(r.term), 6);
});
test('alpha equivalence respects free names and shadowing', () => {
  assert.ok(C.equal(p('λx.λy.x y'), p('λa.λb.a b')));
  assert.ok(!C.equal(p('λx.x y'), p('λx.x z')));
  assert.ok(!C.equal(p('λx.λx.x'), p('λx.λy.x')));
});
test('non-numeral is not falsely decoded', () => assert.equal(C.churchNumber(p('λf x.x f')), null));
test('zero is Church numeral 0', () => assert.equal(C.churchNumber(p('λf x.x')), 0));
test('step limit is explicit', () => assert.equal(C.normalize(p('(λx.x)(λy.y)'), 0).status, 'limit'));
test('node inspection counts every occurrence, including shared trees', () => {
  const t = p('λx.x'); assert.equal(C.inspect(C.A(t,t)).nodes, 5);
});
test('expanding substitution is bounded before acceptance', () => {
  let argument = C.V('z'); for(let i=0;i<11;i++) argument=C.A(argument, argument);
  assert.throws(() => C.substitute(C.A(C.V('x'), C.V('x')), 'x', argument), /4000/);
});
test('redex path and substitution explanation agree', () => {
  const r = C.step(p('λz.f ((λx.x) z)'));
  assert.deepEqual(r.path, ['body','arg']); assert.equal(r.param, 'x'); assert.equal(C.format(r.argument), 'z');
});
test('normal form has no next step', () => assert.equal(C.step(p('λx.x')), null));
test('repeated very long names have an explicit output budget', () => {
  let t=C.V('x'.repeat(1000));for(let i=0;i<5;i++) t=C.A(t,t);
  assert.throws(()=>C.inspect(t),/文本过长/);
});
