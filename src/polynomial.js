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
  ['evalpoly','λp x.fold (λr a.radd (rmul r x) a) (pair 0 1) p']
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
 const differentiate=coefficients=>compile(`diff (${polynomial(coefficients)})`);
 const integrate=coefficients=>compile(`integ (${polynomial(coefficients)})`);
 const derivativeAt=coefficients=>compile(`λx.evalpoly (diff (${polynomial(coefficients)})) x`);
 const integralFunction=coefficients=>compile(`λa b.(λp.rsub (evalpoly p b) (evalpoly p a)) (integ (${polynomial(coefficients)}))`);
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
 const API={polynomial,differentiate,integrate,derivativeAt,integralFunction,definite,readRational,readPolynomial,formatRational,formatPolynomial};
 root.LambdaPolynomial=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
