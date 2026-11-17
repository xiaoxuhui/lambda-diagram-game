(function(root){
 'use strict';
 const C=root.LambdaCore||require('./core.js');
 // These are Lambda programs, not JavaScript differentiation/integration.
 // Lists are descending powers; each coefficient is a Church pair (numerator,denominator).
 const definitions=[
  ['t','λx y.x'],['f','λx y.y'],['pair','λa b k.k a b'],['nil','λc n.n'],['cons','λh r c n.c h (r c n)'],
  ['add','λm n g x.m g (n g x)'],['mul','λm n g.m (n g)'],['succ','λn g x.g (n g x)'],
  ['pred','λn g x.n (λa b.b (a g)) (λu.x) (λu.u)'],['sub','λm n.n pred m'],['zero','λn.n (λx.f) t'],
  ['rmul','λa n.zero n (pair 0 1) (pair (mul (a t) n) (a f))'],['rdiv','λa n.pair (a t) (mul (a f) n)'],
  ['radd','λa b.zero (a t) b (zero (b t) a (pair (add (mul (a t) (b f)) (mul (b t) (a f))) (mul (a f) (b f))))'],
  ['rsub','λa b.zero (b t) a (pair (sub (mul (a t) (b f)) (mul (b t) (a f))) (mul (a f) (b f)))'],
  ['diff','λp.(p (λa s.(λi r.pair (succ i) (zero i r (cons (rmul a i) r))) (s t) (s f)) (pair 0 nil)) f'],
  ['integ','λp.(p (λa s.(λi r.pair (succ i) (cons (rdiv a (succ i)) r)) (s t) (s f)) (pair 0 (cons (pair 0 1) nil))) f'],
  ['fold','λg z p.p (λa h s.h (g s a)) (λs.s) z'],
  ['evalpoly','λp x.fold (λr a.radd (rmul r x) a) (pair 0 1) p'],
  ['divmod',`λm base emit.
    (λreset.m (λstate.state (λleft remainder quotient.left
      (λtail k.k tail (succ remainder) quotient)
      (λk.k reset 0 (succ quotient))))
      (λk.k reset 0 0) (λleft remainder quotient.emit quotient remainder))
    ((pred base) (λtail next done.next tail) (λnext done.done))`],
  // For natural coefficients, f(1) bounds every coefficient. The base-(f(1)+1)
  // digits of f(f(1)+1) therefore recover the coefficient list exactly.
  ['encodepoly',`λfunction.
    (λsum.zero sum (cons (pair 0 1) nil)
      ((λbase.(λvalue.value
        (λnext remaining digits.zero remaining digits
          (divmod remaining base (λquotient digit.next quotient (cons (pair digit 1) digits))))
        (λremaining digits.digits) value nil)
        (function base)) (succ sum)))
    (function 1)`]
 ].map(([name,source])=>({name,source,free:C.freeVars(C.parse(source))}));
 function compile(body){
  const needed=new Set(C.freeVars(C.parse(body,Infinity)));
  for(let i=definitions.length-1;i>=0;i--){const d=definitions[i];if(!needed.has(d.name))continue;
   body=`(λ${d.name}.${body}) (${d.source})`;needed.delete(d.name);for(const name of d.free)needed.add(name);
  }
  if(needed.size)throw new Error('Unbound polynomial program: '+[...needed].join(','));
  return body;
 }
 function polynomial(coefficients){
  if(!Array.isArray(coefficients)||!coefficients.length)throw new Error('多项式系数不能为空。');
  let body='n';
  for(const raw of coefficients){const [a,b]=Array.isArray(raw)?raw:[raw,1];
   if(!Number.isSafeInteger(a)||a<0||!Number.isSafeInteger(b)||b<1)throw new Error('系数必须为非负自然数或正分母有理数。');
   body=`c (λk.k ${a} ${b}) (${body})`;
  }
  return `λc n.${body}`;
 }
 const programs={
  EVAL:compile('λp x.evalpoly p x'),
  DIFF:compile('λp.diff p'),
  INTEGRATE:compile('λp.integ p'),
  DERIVATIVE:compile('λp x.evalpoly (diff p) x'),
  DEFINITE:compile('λp a b.(λprimitive.rsub (evalpoly primitive b) (evalpoly primitive a)) (integ p)')
 };
 function program(operation){
  if(!Object.hasOwn(programs,operation))throw new C.LambdaError('未知多项式运算。');
  return programs[operation];
 }
 function expression(operation,source,...args){
  return `(${program(operation)}) (${source})`+args.map(arg=>` (${arg})`).join('');
 }
 const churchPrograms={
  ENCODE:compile('λfunction.encodepoly function'),
  EVAL:compile('λfunction x.evalpoly (encodepoly function) x'),
  DIFF:compile('λfunction.diff (encodepoly function)'),
  INTEGRATE:compile('λfunction.integ (encodepoly function)'),
  DERIVATIVE:compile('λfunction x.evalpoly (diff (encodepoly function)) x'),
  DEFINITE:compile('λfunction a b.(λprimitive.rsub (evalpoly primitive b) (evalpoly primitive a)) (integ (encodepoly function))')
 };
 function churchProgram(operation){
  if(!Object.hasOwn(churchPrograms,operation))throw new C.LambdaError('未知多项式运算。');
  return churchPrograms[operation];
 }
 function churchExpression(operation,source,...args){
  return `(${churchProgram(operation)}) (${source})`+args.map(arg=>` (${arg})`).join('');
 }
 function churchFunction(coefficients){
  if(!coefficients.length||coefficients.some(n=>!Number.isSafeInteger(n)||n<0))throw new C.LambdaError('丘奇多项式需要自然数系数。');
  let body=String(coefficients.at(-1));
  for(let i=coefficients.length-2;i>=0;i--)body=`add (mul (${body}) x) ${coefficients[i]}`;
  return `λx.(λadd mul.${body}) (λm n f z.m f (n f z)) (λm n f.m (n f))`;
 }
 const differentiate=coefficients=>expression('DIFF',polynomial(coefficients));
 const integrate=coefficients=>expression('INTEGRATE',polynomial(coefficients));
 const derivativeAt=coefficients=>expression('DERIVATIVE',polynomial(coefficients));
 const integralFunction=coefficients=>expression('DEFINITE',polynomial(coefficients));
 function definite(coefficients,a,b){
  if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<a)throw new Error('端点需为自然数且下限不大于上限。');
  return `(${integralFunction(coefficients)}) ${a} ${b}`;
 }
 const variable=(term,name)=>term?.type==='var'&&term.name===name;
 function natural(term){
  const value=C.churchNumber(term);if(value!==null)return value;
  return term?.type==='abs'&&term.body.type==='abs'&&C.equal(term,C.parse('0'))?0:null;
 }
 function readRational(term){
  if(term?.type!=='abs')return null;const body=term.body;
  if(body.type!=='app'||body.fn.type!=='app'||!variable(body.fn.fn,term.param))return null;
  const n=natural(body.fn.arg),d=natural(body.arg);return n===null||d===null||d===0?null:[n,d];
 }
 function readPolynomial(term){
  if(term?.type!=='abs'||term.body.type!=='abs'||term.param===term.body.param)return null;
  const c=term.param,n=term.body.param,coefficients=[];let body=term.body.body;
  while(!variable(body,n)){
   if(body?.type!=='app'||body.fn.type!=='app'||!variable(body.fn.fn,c))return null;
   const value=readRational(body.fn.arg);if(!value)return null;coefficients.push(value);body=body.arg;
  }
  return coefficients;
 }
 function formatRational(value){
  if(!value)return null;let [n,d]=value.map(BigInt),a=n,b=d;while(b){const r=a%b;a=b;b=r;}n/=a;d/=a;
  return d===1n?String(n):`${n}/${d}`;
 }
 function formatPolynomial(coefficients){
  if(!coefficients)return null;const terms=[];
  for(let i=0;i<coefficients.length;i++){
   const value=formatRational(coefficients[i]),degree=coefficients.length-1-i;if(value==='0')continue;
   const exponent=degree===0?'':degree===1?'x':degree===2?'x²':degree===3?'x³':`x^${degree}`;
   terms.push((degree&&value==='1'?'':value)+exponent);
  }
  return terms.join(' + ')||'0';
 }
 const API={polynomial,program,expression,churchProgram,churchExpression,churchFunction,differentiate,integrate,derivativeAt,integralFunction,definite,readRational,readPolynomial,formatRational,formatPolynomial};
 root.LambdaPolynomial=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
