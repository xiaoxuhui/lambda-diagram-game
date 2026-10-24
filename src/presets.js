(function(root) {
  'use strict';
  const M=root.LambdaPolynomial||require('./polynomial.js');
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
  const PERMUTATIONS=`λn k.(k (λp.(${PAIR}) ((${PRED}) (p (${TRUE}))) ((${MULT}) (p (${TRUE})) (p (${FALSE})))) ((${PAIR}) n 1)) (${FALSE})`;
  const sumPowers=power=>`λn.(n (λp.(λi.(${PAIR}) i ((${ADD}) (p (${FALSE})) ((${POW}) i ${power}))) ((${SUCC}) (p (${TRUE})))) ((${PAIR}) 0 0)) (${FALSE})`;
  const GEOMETRIC_SUM=`λb n.(n (λp.(${PAIR}) ((${MULT}) b (p (${TRUE}))) ((${ADD}) (p (${FALSE})) (p (${TRUE})))) ((${PAIR}) 1 0)) (${FALSE})`;
  const BINOMIAL=`λa b n.((${SUCC}) n (λp.(λk.(${PAIR}) ((${SUCC}) k) ((${ADD}) (p (${FALSE})) ((${MULT}) ((${CHOOSE}) n k) ((${MULT}) ((${POW}) a ((${SUB}) n k)) ((${POW}) b k))))) (p (${TRUE}))) ((${PAIR}) 0 0)) (${FALSE})`;
  const POLYNOMIAL=`λx.(${ADD}) ((${MULT}) ((${ADD}) ((${MULT}) 2 x) 3) x) 1`;
  const DERIVATIVE=M.derivativeAt([0,3,1]),INTEGRAL=M.integralFunction([0,2]);
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
    { name:'组合数 · C(4, 2) → 6', category:'高等数学', term:`(${CHOOSE}) 4 2`, expected:'6', description:`从 4 个不同元素中选 2 个，不计顺序，共 6 种。使用帕斯卡递推 C(n,k) = C(n−1,k−1) + C(n−1,k)。${recursiveHint}` },
    { name:'斐波那契 · F(5) → 5', category:'阶乘与递归', term:`(${FIBONACCI}) 5`, expected:'5', description:`F(0) = 0，F(1) = 1，后续每项是前两项之和。${recursiveHint}` },
    { name:'排列数 · A(4, 2) → 12', category:'高等数学', term:`(${PERMUTATIONS}) 4 2`, expected:'12', description:'从 4 个不同元素中依次选 2 个，顺序不同算不同排列。下降连乘 4 × 3 = 12；选 0 个的结果为 1。' },
    { name:'自然数求和 · 1 + … + 5 → 15', category:'高等数学', term:`(${sumPowers(1)}) 5`, expected:'15', description:'用有序对记录当前下标与累计和，迭代计算 Σ i（i 从 1 到 5），得到 15。输入 0 表示空和，结果为 0。' },
    { name:'平方和 · 1² + 2² + 3² → 14', category:'高等数学', term:`(${sumPowers(2)}) 3`, expected:'14', description:'逐项求平方再相加：1 + 4 + 9 = 14。表达式中的最后一个 3 是求和上界，可以改成其他自然数。' },
    { name:'立方和 · 1³ + 2³ + 3³ → 36', category:'高等数学', term:`(${sumPowers(3)}) 3`, expected:'36', description:'逐项求立方再相加：1 + 8 + 27 = 36，也等于 (1 + 2 + 3)²。每次幂运算与求和都经过 β 归约。' },
    { name:'等比求和 · 1 + 2 + 4 + 8 → 15', category:'高等数学', term:`(${GEOMETRIC_SUM}) 2 4`, expected:'15', description:'参数 2 是公比，4 是项数。从首项 1 开始，一边乘公比一边累加，得到 15；项数为 0 时结果为 0。' },
    { name:'二项式系数和 · C(3,0) + … + C(3,3) → 8', category:'高等数学', term:`(${BINOMIAL}) 1 1 3`, expected:'8', description:`把二项式展开中的 a、b 都设为 1，实际计算第 3 行系数和 1 + 3 + 3 + 1 = 8。${recursiveHint}` },
    { name:'二项式展开 · (1 + 2)³ → 27', category:'高等数学', term:`(${BINOMIAL}) 1 2 3`, expected:'27', description:`逐项计算 Σ C(n,k) a^(n−k) b^k。这里 a=1、b=2、n=3，四项为 1、6、12、8，总和 27。${recursiveHint}` },
    { name:'多项式 · 2x² + 3x + 1，x=2 → 15', category:'高等数学', term:`(${POLYNOMIAL}) 2`, expected:'15', description:'使用 Horner 形式 (2x + 3)x + 1 计算多项式。把 x=2 代入，得到 (4 + 3) × 2 + 1 = 15。' },
    { name:'符号求导并求值 · (x² + 3x)′，x=2 → 7', category:'高等数学', term:`(${DERIVATIVE}) 2`, expected:'7', expectedType:'rational', description:'原多项式 x² + 3x 按次数降序以系数 [1,3,0] 编码。Lambda程序先遍历原系数生成导函数 2x + 3，再代入 x=2；结果是有理数 7。可选「生成导函数」单独观察符号转换。' },
    { name:'定积分 · ∫₀³ 2x dx → 9', category:'高等数学', term:`(${INTEGRAL}) 0 3`, expected:'9', expectedType:'rational', description:'输入的是原多项式 2x（降序系数 [2,0]）。Lambda程序先按次数生成原函数系数，再分别代入上下限并相减，得到 9；没有预先把 x² 当成输入。系数限非负有理数，端点限自然数 a≤b。' },
    { name:'生成导函数 · x² + 3x → 2x + 3', category:'高等数学', term:M.differentiate([0,3,1]), expected:'2x + 3', expectedType:'polynomial', description:'原式：x² + 3x。输入列表按次数降序存储 [1,3,0]，每项是有理数。Lambda程序按次数乘系数、去掉原常数项，实际生成新多项式；运行后结果区显示导函数 2x + 3。' },
    { name:'生成原函数 · 2x → x²（C=0）', category:'高等数学', term:M.integrate([0,2]), expected:'x²', expectedType:'polynomial', description:'原式：2x。输入列表只含原系数 [2,0]；Lambda程序按次数+1除系数，并追加积分常数0，实际生成原函数。这里取 C=0；同一算法输入 x 会生成 1/2x²，不是预置答案。' },
    { name:'列表小数加法 · 0.1 + 0.2 → 0.3', category:'列表小数四则', encoding:'decimal',term:'ADD 0.1 0.2',expected:'0.3',expectedType:'decimal',description:'默认数值编码：符号、十进制数字列表、小数位置。逐位对齐、进位得到精确0.3，不使用浮点数预算答案；可用快速运行保留全部步骤。' },
    { name:'列表小数减法 · 1 − 2 → −1', category:'列表小数四则', encoding:'decimal',term:'SUB 1 2',expected:'-1',expectedType:'decimal',description:'默认整数也采用列表编码。先比较绝对值，再逐位借位并确定符号，结果为负数−1。' },
    { name:'列表小数乘法 · 0.2 × 0.3 → 0.06', category:'列表小数四则', encoding:'decimal',term:'MUL 0.2 0.3',expected:'0.06',expectedType:'decimal',description:'逐位竖式相乘，小数位数相加，结果为精确0.06。' },
    { name:'列表小数除法 · 1 ÷ 8 → 0.125', category:'列表小数四则', encoding:'decimal',term:'DIV 1 8',expected:'0.125',expectedType:'decimal',description:'用十进制长除法生成小数数字。精度至少3位时结果精确为0.125；精度不足会标≈。选择快速运行可保留全部归约步骤。' }
  ];
  const levels = [
    { id:1, name:'原样返回', topic:'恒等函数', description:'让恒等函数接收一个函数，看看它如何把输入原样返回。', start:'(λx.x) (λy.y)', target:I, targetLabel:'I · 恒等函数', hint:'λx.x 会把参数直接返回。点击「单步」，观察 x 被整个参数替换。' },
    { id:2, name:'选择第一个', topic:'布尔值', description:'两个函数交给 TRUE；归约后应只留下第一个。', start:`(${TRUE}) (${I}) (${TRUE})`, target:I, targetLabel:'I · 恒等函数', hint:'λx.λy.x 接收两个参数，只保留第一个。第二个参数可以是任意式。' },
    { id:3, name:'翻转真假', topic:'函数组合', description:'将 TRUE 交给 NOT，把选择第一个变成选择第二个。', start:`(λb.b (${FALSE}) (${TRUE})) (${TRUE})`, target:FALSE, targetLabel:'FALSE · 选择第二个', hint:'布尔值本身是一个选择器。NOT 把 FALSE 放在第一位，把 TRUE 放在第二位。' },
    { id:4, name:'再走一步', topic:'Church 数', description:'将 2 交给后继函数，让 f 在 x 上连续作用 3 次。', start:`(${SUCC}) (${TWO})`, target:THREE, targetLabel:'Church 数字 3', hint:'数字 n 表示重复 n 次。「加一」会在 n 次作用之外，再套上一层 f。' },
    { id:5, name:'让函数相加', topic:'Church 加法', description:'不用数字运算，只靠函数，把 2 + 3 归约成 5。', start:`(${ADD}) (${TWO}) (${THREE})`, target:FIVE, targetLabel:'Church 数字 5', hint:'m f (n f x)：先把 f 作用 n 次，再继续作用 m 次。运行到正规形后验证答案。' }
  ];
  const API={ examples, levels, I, TRUE, FALSE, advanced:{factorial:FACTORIAL,recursiveFactorial:RECURSIVE_FACTORIAL,choose:CHOOSE,permutations:PERMUTATIONS,sumPowers,geometricSum:GEOMETRIC_SUM,binomial:BINOMIAL,polynomial:POLYNOMIAL,derivative:DERIVATIVE,integral:INTEGRAL} };
  root.LambdaPresets=API;
  if(typeof module !== 'undefined' && module.exports) module.exports=API;
})(typeof globalThis !== 'undefined' ? globalThis : window);
