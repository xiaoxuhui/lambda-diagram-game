(function(root) {
  'use strict';
  const I='λx.x', TRUE='λx.λy.x', FALSE='λx.λy.y';
  const TWO='λf.λx.f (f x)', THREE='λf.λx.f (f (f x))', FIVE='λf.λx.f (f (f (f (f x))))';
  const ADD='λm.λn.λf.λx.m f (n f x)', SUCC='λn.λf.λx.f (n f x)';
  const MULT='λm n f.m (n f)', POW='λb e.e b';
  const PRED='λn f x.n (λg h.h (g f)) (λu.x) (λu.u)';
  const SUB=`λm n.n (${PRED}) m`, ZERO=`λn.n (λx.(${FALSE})) (${TRUE})`;
  const PAIR='λa b k.k a b', Y='λf.(λx.f (x x)) (λx.f (x x))';
  const FACTORIAL=`λn.(n (λp.(${PAIR}) ((${SUCC}) (p (${TRUE}))) ((${MULT}) ((${SUCC}) (p (${TRUE}))) (p (${FALSE})))) ((${PAIR}) 0 1)) (${FALSE})`;
  const RECURSIVE_FACTORIAL=`(${Y}) (λr n.(${ZERO}) n 1 ((${MULT}) n (r ((${PRED}) n))))`;
  const CHOOSE=`(${Y}) (λr n k.(${ZERO}) k 1 ((${ZERO}) n 0 ((${ADD}) (r ((${PRED}) n) ((${PRED}) k)) (r ((${PRED}) n) k))))`;
  const FIBONACCI=`(${Y}) (λr n.(${ZERO}) n 0 ((${ZERO}) ((${PRED}) n) 1 ((${ADD}) (r ((${PRED}) n)) (r ((${PRED}) ((${PRED}) n))))))`;
  const recursiveHint='使用显式 Y 不动点组合子。建议选择「正规序」「从左到右」运行，先判断终止条件；其他顺序可能无法终止。';
  const examples = [
    { name:'恒等函数 I', term:I },
    { name:'TRUE · 选择第一个', term:TRUE },
    { name:'FALSE / 数字 0', term:FALSE },
    { name:'Church 数字 2', term:TWO },
    { name:'S K K → I', term:`(λx y z.(x z) (y z)) (${TRUE}) (${TRUE})` },
    { name:'加法 · 2 + 3', term:`(${ADD}) (${TWO}) (${THREE})` },
    { name:'Ω · 无限循环', term:'(λx.x x) (λx.x x)' },
    { name:'防止变量捕获', term:'(λx.λy.x) y' },
    { name:'组合子 B · 连续加一 → 5', category:'组合子', term:`(λf g x.f (g x)) (${SUCC}) (${SUCC}) 3`, expected:'5', description:'B 把两个函数串起来：先执行 g，再执行 f。把两个加一组合起来，3 变成 5。' },
    { name:'组合子 C · 交换参数 → 3', category:'组合子', term:`(λf x y.f y x) (${TRUE}) 2 3`, expected:'3', description:'C 交换函数的两个参数。TRUE 原本选择第一个，交换 2 和 3 后返回 3。' },
    { name:'组合子 W · 复制参数 → 9', category:'组合子', term:`(λf x.f x x) (${MULT}) 3`, expected:'9', description:'W 把一个参数交给函数两次。把乘法和 3 交给它，得到 3 × 3 = 9。' },
    { name:'乘法 · 2 × 3 → 6', category:'算术与判断', term:`(${MULT}) 2 3`, expected:'6', description:'把重复 3 次的函数再重复 2 次，结果是 Church 数 6。' },
    { name:'乘方 · 2⁴ → 16', category:'算术与判断', term:`(${POW}) 2 4`, expected:'16', description:'Church 数也能当函数使用：指数 4 作用在底数 2 上，归约得到 16。' },
    { name:'前驱 · 3 − 1 → 2', category:'算术与判断', term:`(${PRED}) 3`, expected:'2', description:'前驱函数去掉一次函数作用；0 的前驱仍然是 0。' },
    { name:'减法 · 5 − 2 → 3', category:'算术与判断', term:`(${SUB}) 5 2`, expected:'3', description:'对 5 连续取两次前驱，得到 3。这是自然数减法，小于 0 时停在 0。' },
    { name:'零判断 · 0 = 0 → TRUE', category:'算术与判断', term:`(${ZERO}) 0`, expected:TRUE, description:'把数字变成布尔选择器：输入 0 返回 TRUE，其他自然数返回 FALSE。' },
    { name:'比较 · 2 ≤ 3 → TRUE', category:'算术与判断', term:`(λm n.(${ZERO}) ((${SUB}) m n)) 2 3`, expected:TRUE, description:'自然数减法 2 − 3 截断为 0，因此零判断为真，表示 2 ≤ 3。' },
    { name:'有序对 · 读取 (3, 5) 的第二项 → 5', category:'数据结构', term:`(${PAIR}) 3 5 (${FALSE})`, expected:'5', description:'有序对也是函数：保存两个值，再用 TRUE 或 FALSE 选择第一项或第二项。这里取出 5。' },
    { name:'阶乘 · 迭代计算 3! → 6', category:'阶乘与递归', term:`(${FACTORIAL}) 3`, expected:'6', description:'用 Church 数重复更新「当前数字、累计乘积」有序对，计算 1 × 2 × 3 = 6；不需要递归。' },
    { name:'阶乘 · Y 递归计算 3! → 6', category:'阶乘与递归', term:`(${RECURSIVE_FACTORIAL}) 3`, expected:'6', description:`递归规则：0! = 1，n! = n × (n − 1)!。${recursiveHint}` },
    { name:'组合数 · C(4, 2) → 6', category:'阶乘与递归', term:`(${CHOOSE}) 4 2`, expected:'6', description:`从 4 个不同元素中选 2 个，不计顺序，共 6 种。使用帕斯卡递推 C(n,k) = C(n−1,k−1) + C(n−1,k)。${recursiveHint}` },
    { name:'斐波那契 · F(5) → 5', category:'阶乘与递归', term:`(${FIBONACCI}) 5`, expected:'5', description:`F(0) = 0，F(1) = 1，后续每项是前两项之和。${recursiveHint}` }
  ];
  const levels = [
    { id:1, name:'原样返回', topic:'恒等函数', description:'让恒等函数接收一个函数，看看它如何把输入原样返回。', start:'(λx.x) (λy.y)', target:I, targetLabel:'I · 恒等函数', hint:'λx.x 会把参数直接返回。点击「单步」，观察 x 被整个参数替换。' },
    { id:2, name:'选择第一个', topic:'布尔值', description:'两个函数交给 TRUE；归约后应只留下第一个。', start:`(${TRUE}) (${I}) (${TRUE})`, target:I, targetLabel:'I · 恒等函数', hint:'λx.λy.x 接收两个参数，只保留第一个。第二个参数可以是任意式。' },
    { id:3, name:'翻转真假', topic:'函数组合', description:'将 TRUE 交给 NOT，把选择第一个变成选择第二个。', start:`(λb.b (${FALSE}) (${TRUE})) (${TRUE})`, target:FALSE, targetLabel:'FALSE · 选择第二个', hint:'布尔值本身是一个选择器。NOT 把 FALSE 放在第一位，把 TRUE 放在第二位。' },
    { id:4, name:'再走一步', topic:'Church 数', description:'将 2 交给后继函数，让 f 在 x 上连续作用 3 次。', start:`(${SUCC}) (${TWO})`, target:THREE, targetLabel:'Church 数字 3', hint:'数字 n 表示重复 n 次。「加一」会在 n 次作用之外，再套上一层 f。' },
    { id:5, name:'让函数相加', topic:'Church 加法', description:'不用数字运算，只靠函数，把 2 + 3 归约成 5。', start:`(${ADD}) (${TWO}) (${THREE})`, target:FIVE, targetLabel:'Church 数字 5', hint:'m f (n f x)：先把 f 作用 n 次，再继续作用 m 次。运行到正规形后验证答案。' }
  ];
  const API={ examples, levels, I, TRUE, FALSE, advanced:{factorial:FACTORIAL,recursiveFactorial:RECURSIVE_FACTORIAL,choose:CHOOSE} };
  root.LambdaPresets=API;
  if(typeof module !== 'undefined' && module.exports) module.exports=API;
})(typeof globalThis !== 'undefined' ? globalThis : window);
