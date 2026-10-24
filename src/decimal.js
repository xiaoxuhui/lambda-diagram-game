(function(root){
 'use strict';
 const C=root.LambdaCore||require('./core.js');
 // Decimal arithmetic is performed by these Lambda programs on decimal digits.
 const definitions=[
  ['t','λx y.x'],['f','λx y.y'],['i','λx.x'],['not','λp.p f t'],['and','λp q.p q f'],['or','λp q.p t q'],['xor','λp q.p (not q) q'],
  ['pair','λa b k.k a b'],['fst','λp.p t'],['snd','λp.p f'],['nil','λc n.n'],['cons','λh r c n.c h r'],['head','λa.a (λh r.h) 0'],['tail','λa.a (λh r.r) nil'],['empty','λa.a (λh r.f) t'],
  ['add','λm n g x.m g (n g x)'],['mul','λm n g.m (n g)'],['succ','λn g x.g (n g x)'],['pred','λn g x.n (λa b.b (a g)) (λu.x) (λu.u)'],['sub','λm n.n pred m'],['zero','λn.n (λx.f) t'],['lt','λa b.not (zero (sub b a))'],['eq','λa b.and (zero (sub a b)) (zero (sub b a))'],
  ['y','λg.(λx.g (x x)) (λx.g (x x))'],
  ['trim','y (λr a.a (λh xs.(λys.and (zero h) (empty ys) nil (cons h ys)) (r xs)) nil)'],
  ['reverse','λa.(y (λr xs acc.xs (λh rest.r rest (cons h acc)) acc)) a nil'],
  ['pad','λa n.n (cons 0) a'],
  ['cmp','y (λr a b.a (λh xs.b (λz zs.(λv.zero v (lt h z 1 (lt z h 2 0)) v) (r xs zs)) 2) (b (λz zs.1) 0))'],
  ['plus','y (λr a b carry.and (empty a) (empty b) (zero carry nil (cons carry nil)) ((λv.lt v 10 (cons v (r (tail a) (tail b) 0)) (cons (sub v 10) (r (tail a) (tail b) 1))) (add (add (head a) (head b)) carry)))'],
  ['minus','y (λr a b carry.a (λh xs.(λv.lt h v (cons (sub (add h 10) v) (r xs (tail b) 1)) (cons (sub h v) (r xs (tail b) 0))) (add (head b) carry)) nil)'],
  ['table','cons 0 (cons 1 (cons 2 (cons 3 (cons 4 (cons 5 (cons 6 (cons 7 (cons 8 (cons 9 nil)))))))))'],
  ['forceDigit','λn k.n tail table (λh r.k h) (k 0)'],
  ['forceList','y (λr xs k.xs (λh rest.forceDigit h (λv.r rest (λzs.k (cons v zs)))) (k nil))'],
  ['split','y (λr n.lt n 10 (pair 0 n) (r (sub n 10) (λq rem.pair (succ q) rem)))'],
  ['timesdigit','y (λr a b carry.a (λh xs.split (add (mul h b) carry) (λq rem.cons rem (r xs b q))) (zero carry nil (cons carry nil)))'],
  ['times','y (λr a b.b (λh xs.plus (timesdigit a h 0) (cons 0 (r a xs)) 0) nil)'],
  ['divstep','y (λr a b.eq (cmp a b) 1 (pair 0 a) (forceList (trim (minus a b 0)) (λnext.r next b (λq rem.pair (succ q) rem))))'],
  ['longdiv','y (λr xs b q rem.xs (λh rest.divstep (trim (cons h rem)) b (λdigit remainder.forceDigit digit (λd.forceList remainder (λrr.r rest b (cons d q) rr)))) (pair (trim q) rem))'],
  ['sign','λv.v (λtag s d p e.s)'],['digits','λv.v (λtag s d p e.d)'],['scale','λv.v (λtag s d p e.p)'],['approx','λv.v (λtag s d p e.e)'],
  ['make','λs ds p e.(λd.λk.k i (and s (not (empty d))) d p e) (trim ds)'],
  ['align','λa b k.(λp.k (pad (digits a) (sub p (scale a))) (pad (digits b) (sub p (scale b))) p) (lt (scale a) (scale b) (scale b) (scale a))'],
  ['negate','λa.make (not (sign a)) (digits a) (scale a) (approx a)'],
  ['dadd','λa b.align a b (λx z p.(λe.xor (sign a) (sign b) (eq (cmp x z) 1 (make (sign b) (minus z x 0) p e) (make (sign a) (minus x z 0) p e)) (make (sign a) (plus x z 0) p e)) (or (approx a) (approx b)))'],
  ['dsub','λa b.dadd a (negate b)'],
  ['dmul','λa b.make (xor (sign a) (sign b)) (times (digits a) (digits b)) (add (scale a) (scale b)) (or (approx a) (approx b))'],
  ['error','λk.k (λa b c.a) 0'],
  ['ddiv','λprecision a b.empty (digits b) error (align a b (λx z p.longdiv (reverse (pad x precision)) z nil nil (λq rem.make (xor (sign a) (sign b)) q precision (or (or (approx a) (approx b)) (not (empty rem))))))']
 ].map(([name,source])=>({name,source,free:C.freeVars(C.parse(source,Infinity))}));
 const cache=new Map();
 function program(operation,precision=6){
  if(!['ADD','SUB','MUL','DIV'].includes(operation))throw new C.LambdaError('未知小数运算。');
  if(!Number.isSafeInteger(precision)||precision<0)throw new C.LambdaError('除法小数位数需为非负整数。');
  const key=operation+precision;if(cache.has(key))return cache.get(key);
  let body=operation==='DIV'?`ddiv ${precision}`:`d${operation.toLowerCase()}`;
  const needed=new Set(C.freeVars(C.parse(body,Infinity)));
  for(let j=definitions.length-1;j>=0;j--){const d=definitions[j];if(!needed.has(d.name))continue;body=`(λ${d.name}.${body}) (${d.source})`;needed.delete(d.name);for(const name of d.free)needed.add(name);}
  if(needed.size)throw new Error('Unbound decimal program: '+[...needed]);
  const term=C.parse(body,Infinity);cache.set(key,term);return term;
 }
 const digitTerms=Array.from({length:10},(_,n)=>C.parse(String(n))),nil=C.parse('λc n.n'),identity=C.parse('λx.x'),truth=C.parse('λx y.x'),falsity=C.parse('λx y.y');
 function encodeLiteral(text){
  const match=/^(-?)(\d+)(?:\.(\d+))?$/.exec(String(text));if(!match)throw new C.LambdaError('请填写整数或小数，例如 -12.375。');
  let fraction=(match[3]||'').replace(/0+$/,''),raw=(match[2]+fraction).replace(/^0+/,'');
  let list=nil;for(const digit of raw)list=C.L('c',C.L('n',C.A(C.A(C.V('c'),digitTerms[Number(digit)]),list)));
  const sign=raw&&match[1]?truth:falsity,scale=C.parse(String(fraction.length));
  return C.L('k',[identity,sign,list,scale,falsity].reduce((a,b)=>C.A(a,b),C.V('k')));
 }
 const isVar=(t,name)=>t?.type==='var'&&t.name===name;
 function nat(t){const n=C.churchNumber(t);return n!==null?n:t?.type==='abs'&&t.body.type==='abs'&&C.equal(t,digitTerms[0])?0:null;}
 function read(term){
  if(term?.type!=='abs')return null;const args=[];let body=term.body;
  while(body.type==='app'){args.unshift(body.arg);body=body.fn;}
  if(!isVar(body,term.param))return null;
  if(args.length===2&&C.equal(args[0],C.parse('λa b c.a'))&&nat(args[1])===0)return {error:'除数不能为0'};
  if(args.length!==5||!C.equal(args[0],identity))return null;
  const negative=C.equal(args[1],truth),positive=C.equal(args[1],falsity),approximate=C.equal(args[4],truth),exact=C.equal(args[4],falsity),places=nat(args[3]);
  if((!negative&&!positive)||(!approximate&&!exact)||places===null)return null;
  const digits=[];let list=args[2];
  while(true){
   if(list.type!=='abs'||list.body.type!=='abs'||list.param===list.body.param)return null;
   const c=list.param,n=list.body.param,b=list.body.body;if(isVar(b,n))break;
   if(b.type!=='app'||b.fn.type!=='app'||!isVar(b.fn.fn,c))return null;
   const digit=nat(b.fn.arg);if(digit===null||digit>9)return null;digits.push(digit);list=b.arg;
  }
  return {negative,digits,places,approximate};
 }
 function format(value){
  if(!value)return null;if(value.error)return value.error;
  let digits=[...value.digits].reverse().join('')||'0';digits=digits.padStart(value.places+1,'0');
  let text=value.places?digits.slice(0,-value.places)+'.'+digits.slice(-value.places):digits;
  text=text.replace(/^0+(?=\d)/,'').replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
  return (value.approximate?'≈ ':'')+(value.negative&&!/^0(?:\.0*)?$/.test(text)?'-':'')+text;
 }
 function expand(term,precision=6){
  for(const name of C.freeVars(term)){const match=/^(?:DEC_)?(ADD|SUB|MUL|DIV)$/.exec(name);if(match)term=C.substitute(term,name,program(match[1],precision));}return term;
 }
 const API={encodeLiteral,read,format,program,expand};root.LambdaDecimal=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
