(function(root) {
  'use strict';
  const M=root.LambdaPolynomial||require('./polynomial.js'),D=root.LambdaDecimal||require('./decimal.js');
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
  const POWER='λb e f x.e b f x';
  const TETRATION=`λb h.h ((${POWER}) b) 1`;
  const PENTATION=`λb h.h ((${TETRATION}) b) 1`;
  // The Scott list supplies one unit of fuel per successor. The continuation
  // can return as soon as fuel runs out, even if the Church output is huge.
  const AT_MOST=`λm n.m (λlater fuel.fuel (λrest.later rest) (${FALSE})) (λfuel.(${TRUE}))
    (n (λrest next done.next rest) (λnext done.done))`;
  const FLOOR_INVERSE=`λop target start.
    ((${Y}) (λsearch candidate previous.
      (λvalue.(${AT_MOST}) value target
        ((${AT_MOST}) target value candidate (search ((${SUCC}) candidate) candidate))
        previous)
      (op candidate))) start 0`;
  const QUOTIENT=`λn divisor.(${ZERO}) divisor (λk.k (λa b c.a) 0)
    ((${FLOOR_INVERSE}) ((${MULT}) divisor) n 0)`;
  const PAIR_DIVISION=`λm n.(${ZERO}) n (λk.k (λa b c.a) 0)
    ((m (λp.p (λr q.(${AT_MOST}) n r
      ((${PAIR}) ((${SUB}) r n) ((${SUCC}) q))
      ((${PAIR}) r q)))
      ((${PAIR}) m 0)) (λr q k.k (${TRUE}) r q))`;
  const rootOf=operator=>`λn degree.(${ZERO}) degree (${I})
    ((${FLOOR_INVERSE}) (λbase.(${operator}) base degree) n 1)`;
  const logOf=operator=>`λbase n.(${AT_MOST}) base 1 (${I})
    ((${ZERO}) n (${I}) ((${FLOOR_INVERSE}) ((${operator}) base) n 0))`;
  const SQRT=rootOf(POWER);
  const LOG=logOf(POWER), SUPER_ROOT=rootOf(TETRATION), SUPER_LOG=logOf(TETRATION);
  const PENTA_ROOT=rootOf(PENTATION), PENTA_LOG=logOf(PENTATION);
  const DERIVATIVE=M.derivativeAt([0,3,1]),INTEGRAL=M.integralFunction([0,2]);
  const recursiveHint='使用显式 Y 不动点组合子。建议选择「正规序」「从左到右」运行，先判断终止条件；其他顺序可能无法终止。';
  const NIL='λc n.n', CONS='λh t c n.c h (t c n)';
  const churchList=items=>`λc n.${items.reduceRight((tail,head)=>`c (${head}) (${tail})`,'n')}`;
  const HEAD='λl d.l (λh r.h) d', EMPTY=`λl.l (λh r.(${FALSE})) (${TRUE})`;
  const LENGTH=`λl.l (λh r.(${SUCC}) r) 0`;
  const TAIL=`λl.(l (λh p.(${PAIR}) ((${CONS}) h (p (${TRUE}))) (p (${TRUE}))) ((${PAIR}) (${NIL}) (${NIL}))) (${FALSE})`;
  const MAP='λf l c n.l (λh r.c (f h) r) n', APPEND='λa b c n.a c (b c n)';
  const REVERSE=`λl.l (λh r a.r ((${CONS}) h a)) (${I}) (${NIL})`;
  const FILTER='λp l c n.l (λh r.p h (c h r) r) n';
  const listExample=(name,term,expected,description,expectedLabel)=>({name,category:'丘奇列表',encoding:term===NIL?'list':'church',term,expected,description,expectedLabel});
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
    { name:'乘法 · 2 × 3 → 6', category:'基础数学', term:`(${MULT}) 2 3`, expected:'6', description:'把重复 3 次的函数再重复 2 次，结果是 Church 数 6。' },
    { name:'乘方 · 2⁴ → 16', category:'基础数学', term:`(${POW}) 2 4`, expected:'16', parameters:['底数 2','指数 4'], description:'Church 数也能当函数使用：指数 4 作用在底数 2 上，归约得到 16。' },
    { name:'前驱 · 3 − 1 → 2', category:'基础数学', term:`(${PRED}) 3`, expected:'2', description:'前驱函数去掉一次函数作用；0 的前驱仍然是 0。' },
    { name:'减法 · 5 − 2 → 3', category:'基础数学', term:`(${SUB}) 5 2`, expected:'3', description:'对 5 连续取两次前驱，得到 3。这是自然数减法，小于 0 时停在 0。' },
    { name:'零判断 · 0 = 0 → TRUE', category:'基础数学', term:`(${ZERO}) 0`, expected:TRUE, description:'把数字变成布尔选择器：输入 0 返回 TRUE，其他自然数返回 FALSE。' },
    { name:'比较 · 2 ≤ 3 → TRUE', category:'基础数学', term:`(λm n.(${ZERO}) ((${SUB}) m n)) 2 3`, expected:TRUE, description:'自然数减法 2 − 3 截断为 0，因此零判断为真，表示 2 ≤ 3。' },
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
    { name:'多项式 · 2x² + 3x + 1，x=2 → 15', category:'高等数学',term:M.churchExpression('EVAL',M.churchFunction([1,3,2]),'2'),expected:'15',expectedType:'rational',parameters:['原丘奇函数 f(x)=2x² + 3x + 1','代入值 2'],description:'把原函数作为第一个参数传入，程序内部完成丘奇多项式编码和求值。可以将末尾的 λx.… 换成已保存的多项式函数名。' },
    { name:'符号求导并求值 · (x² + 3x)′，x=2 → 7', category:'高等数学',term:M.churchExpression('DERIVATIVE',M.churchFunction([0,3,1]),'2'),expected:'7',expectedType:'rational',parameters:['原丘奇函数 f(x)=x² + 3x','代入值 2'],description:'原式：x² + 3x。程序直接接收普通丘奇多项式函数，在内部编码、生成导函数，再代入求值。参数中的数字按丘奇自然数解释。' },
    { name:'定积分 · ∫₀³ 2x dx → 9', category:'高等数学',term:M.churchExpression('DEFINITE',M.churchFunction([0,2]),'0','3'),expected:'9',expectedType:'rational',parameters:['原丘奇函数 f(x)=2x','积分下限 0','积分上限 3'],description:'原式：2x。积分函数内部包含编码程序，直接接收原丘奇函数、下限和上限，生成原函数后计算端点差。输入函数需为自然数系数多项式，端点需为自然数且下限≤上限。' },
    { name:'生成导函数 · x² + 3x → 2x + 3', category:'高等数学',term:M.churchExpression('DIFF',M.churchFunction([0,3,1])),expected:'2x + 3',expectedType:'polynomial',parameters:['原丘奇函数 f(x)=x² + 3x'],description:'原式：x² + 3x。把普通丘奇函数 λx.… 作为末尾参数传入，求导函数内部完成编码和求导，生成导函数 2x + 3。输入函数需为自然数系数多项式。' },
    { name:'生成原函数 · 2x → x²（C=0）', category:'高等数学',term:M.churchExpression('INTEGRATE',M.churchFunction([0,2])),expected:'x²',expectedType:'polynomial',parameters:['原丘奇函数 f(x)=2x'],description:'原式：2x。把普通丘奇函数 λx.… 作为末尾参数传入，积分函数内部完成编码和积分，生成原函数 x²，积分常数取 0。输入函数需为自然数系数多项式。' },
    { name:'列表小数加法 · 0.1 + 0.2 → 0.3', category:'列表小数四则', encoding:'decimal',term:D.expression('ADD',["0.1","0.2"]),decimalOperation:'ADD',operands:["0.1","0.2"],expected:'0.3',expectedType:'decimal',description:'组合子 B 把「取较大的小数位数」和「补零对齐」接起来。例如 1.2 和 0.03 对齐为 1.20 和 0.03。对齐后同号逐位加，异号用大绝对值减小绝对值。结果保留全部有效位数。' },
    { name:'列表小数减法 · 1 − 2 → −1', category:'列表小数四则', encoding:'decimal',term:D.expression('SUB',["1","2"]),decimalOperation:'SUB',operands:["1","2"],expected:'-1',expectedType:'decimal',description:'默认整数也采用列表编码。先比较绝对值，再逐位借位并确定符号，结果为负数−1。' },
    { name:'列表小数乘法 · 0.2 × 0.3 → 0.06', category:'列表小数四则', encoding:'decimal',term:D.expression('MUL',["0.2","0.3"]),decimalOperation:'MUL',operands:["0.2","0.3"],expected:'0.06',expectedType:'decimal',description:'逐位竖式相乘，小数位数相加，结果为精确0.06。' },
    { name:'列表小数除法 · 1 ÷ 8 → 0.125', category:'列表小数四则', encoding:'decimal',term:D.expression('DIV',["1","8"]),decimalOperation:'DIV',operands:["1","8"],expected:'0.125',expectedType:'decimal',description:'用十进制长除法生成小数数字。精度至少3位时结果精确为0.125；精度不足会标≈。选择快速运行可保留全部归约步骤。' }
  ];
  const list123=churchList([1,2,3]);
  examples.push(
    listExample('丘奇列表 · 空表 []',NIL,NIL,'空表 λc n.n 直接返回折叠初值 n，不调用组合函数 c。它与 FALSE、Church 数0同形。','丘奇列表 []（与 FALSE / Church 数0同形）'),
    listExample('丘奇列表 · 头部插入 1 → [1, 2, 3]',`(${CONS}) 1 (${churchList([2,3])})`,list123,'CONS 接收元素和列表：λh t c n.c h (t c n)。此例把1放到 [2,3] 前面。','丘奇列表 [1, 2, 3]'),
    listExample('丘奇列表 · 首项 HEAD → 1',`(${HEAD}) (${list123}) 0`,'1','HEAD 用 λh r.h 选择首项；第二个参数是空表时返回的默认值，这里为0。'),
    listExample('丘奇列表 · 尾部 TAIL → [2, 3]',`(${TAIL}) (${list123})`,churchList([2,3]),'TAIL 从右折叠，用有序对记录当前后缀与去掉首项的后缀；空表的尾部仍为空表。','丘奇列表 [2, 3]'),
    listExample('丘奇列表 · 判空 [] → TRUE',`(${EMPTY}) (${NIL})`,TRUE,'空表不执行组合函数，保留 TRUE；遇到任意元素就返回 FALSE。'),
    listExample('丘奇列表 · 判空 [1, 2, 3] → FALSE',`(${EMPTY}) (${list123})`,FALSE,'非空表至少调用一次组合函数，所以判空结果为 FALSE。'),
    listExample('丘奇列表 · 长度 LENGTH → 3',`(${LENGTH}) (${list123})`,'3','从0开始，每遇到一个元素就对累计长度加一；不读取元素本身。'),
    listExample('丘奇列表 · 映射 MAP 加一 → [2, 3, 4]',`(${MAP}) (${SUCC}) (${list123})`,churchList([2,3,4]),'MAP 接收函数和列表，对每项应用该函数，并保持原顺序。此处传入 Church 后继函数。','丘奇列表 [2, 3, 4]'),
    listExample('丘奇列表 · 拼接 APPEND → [1, 2, 3]',`(${APPEND}) (${churchList([1,2])}) (${churchList([3])})`,list123,'先折叠第二个列表，再把第一个列表的元素接到前面，得到 [1,2,3]。','丘奇列表 [1, 2, 3]'),
    listExample('丘奇列表 · 反转 REVERSE → [3, 2, 1]',`(${REVERSE}) (${list123})`,churchList([3,2,1]),'折叠生成接收累积列表的函数，逐项插入头部，让元素次序反转。','丘奇列表 [3, 2, 1]'),
    listExample('丘奇列表 · 折叠求和 → 6',`(${list123}) (${ADD}) 0`,'6','Church 列表本身就是右折叠：l c n。将 c 换成加法、n 设为0，计算1 + (2 + (3 + 0))。'),
    listExample('丘奇列表 · 折叠乘积 → 6',`(${list123}) (${MULT}) 1`,'6','将组合函数换成乘法、初值设为1，计算1 × (2 × (3 × 1))；空表乘积为1。'),
    listExample('丘奇列表 · 过滤 FILTER 去零 → [2, 3]',`(${FILTER}) (λh.(${ZERO}) h (${FALSE}) (${TRUE})) (${churchList([0,2,0,3])})`,churchList([2,3]),'FILTER 接收布尔谓词和列表，只保留谓词返回 TRUE 的元素；此处筛掉0，保持剩余元素顺序。','丘奇列表 [2, 3]')
  );
  const integerExample=(name,formula,args,expected,description,labels)=>({
    name,category:'高等数学',encoding:'church',term:`(${formula}) ${args}`,expected,description,
    parameters:args.split(' ').map((value,index)=>`${labels[index]} ${value}`)
  });
  examples.push(
    integerExample('超幂 · 2 ↑↑ 3 → 16',TETRATION,'2 3','16','从 1 开始，重复 3 次「用 2 作底数乘方」，得到 2^(2^2) = 16。',['底数','幂塔高度']),
    integerExample('超超幂 · 2 ↑↑↑ 2 → 4',PENTATION,'2 2','4','从 1 开始，重复 2 次「用 2 作底数做超幂」。',['底数','重复次数']),
    integerExample('开根号 · √10 向下取整 → 3',SQRT,'10 2','3','找最大的自然数，使它的平方不超过 10。要开立方根，把末尾的 2 改成 3。根指数为 0 时返回 I。',['根号内的数','根指数']),
    integerExample('整数除法 · 7 ÷ 2 → 3',QUOTIENT,'7 2','3','找最大的自然数商，使商乘以除数不超过被除数。除数必须大于 0。小数商可用「列表小数四则」里的除法。',['被除数','除数']),
    integerExample('对数 · log₂ 9 向下取整 → 3',LOG,'2 9','3','固定底数，找最大的自然数指数，使幂值不超过输入。底数小于 2 或输入为 0 时返回 I。',['对数底数','真数（要求对数的数）']),
    integerExample('超对数 · 2 ↑↑ h = 16 → h = 3',SUPER_LOG,'2 16','3','固定底数，找最大的自然数高度 h，使 2 ↑↑ h 不超过输入。底数小于 2 或输入为 0 时返回 I。',['底数','目标值']),
    integerExample('超根号 · b ↑↑ 2 = 4 → b = 2',SUPER_ROOT,'4 2','2','固定高度，找最大的正整数底数 b，使 b ↑↑ 2 不超过输入。高度为 0 时返回 I。',['目标值','幂塔高度']),
    integerExample('超超根号 · b ↑↑↑ 2 = 4 → b = 2',PENTA_ROOT,'4 2','2','固定重复次数，找最大的正整数底数 b，使 b ↑↑↑ 2 不超过输入。次数为 0 时返回 I。',['目标值','重复次数']),
    integerExample('超超对数 · 2 ↑↑↑ h = 4 → h = 2',PENTA_LOG,'2 4','2','固定底数，找最大的自然数次数 h，使 2 ↑↑↑ h 不超过输入。底数小于 2 或输入为 0 时返回 I。',['底数','目标值'])
  );
  examples.push({
    name:'序对除法 · 7 ÷ 2 → 商 3，余数 1', category:'基础数学', encoding:'church',
    term:`(${PAIR_DIVISION}) 7 2`, expected:`λk.k (${TRUE}) 1 3`,expectedLabel:'余数 1，商 3',parameters:['被除数 7','除数 2'],
    description:'序对按（剩余量，商）排列。从 (7, 0) 开始，每次减去除数 2，商加 1，依次得到 (5, 1)、(3, 2)、(1, 3)。余量小于除数后，迭代原样返回序对。输出附上 TRUE 标记，供结果区识别。最后两个参数可以编辑，除数为 0 时返回除零错误。'
  });
  const advancedDecimal=(name,operation,operands,expected,description,operandEncodings)=>({
    name,category:'高等小数',encoding:'decimal',decimalOperation:operation,operands,operandEncodings,
    term:D.expression(operation,operands.map((value,index)=>operandEncodings?.[index]==='church'?`${value}_church`:value)),
    expected,expectedType:'decimal',description
  });
  const angleNote='角度用弧度，可输入 −1000 到 1000。先按周期缩小角度，再用泰勒多项式近似。可点「快速求值」。';
  const hyperbolicNote='输入范围 −1 到 1。泰勒多项式给出约三位小数，可点「快速求值」。';
  examples.push(
    advancedDecimal('取负 · −(1.25)','NEG',['1.25'],'-1.25','把符号位翻转，数字列表保持原值，零仍为零。'),
    advancedDecimal('绝对值 · |−2.75|','ABS',['-2.75'],'2.75','清除负号，保留整数和小数数位。'),
    advancedDecimal('幂函数 · (−0.5)³','POW',['-0.5','3'],'-0.125','底数用列表小数，指数用丘奇自然数。指数决定小数乘法的次数。',['decimal','church']),
    advancedDecimal('小数二进制左移一位 · −1.25 → −2.5','SHL',['-1.25'],'-2.5','点击「快速求值」直接显示结果，「运行」逐步归约。只接收一个小数，数字列表加上自身，值翻倍且保留负号。要移三位，可在整个示例表达式前加 3_church。'),
    advancedDecimal('小数二进制右移一位 · 1.25 → 0.625','SHR',['1.25'],'0.625','点击「快速求值」直接显示结果，「运行」逐步归约。只接收一个小数，数位列表乘以 5，小数位数加 1，等于精确除以 2。要移三位，可在整个示例表达式前加 3_church。'),
    advancedDecimal('带符号除法 · −7.5 ÷ 2','DIV',['-7.5','2'],'-3.75','用列表长除法求商，再根据两个输入的符号确定结果正负。'),
    advancedDecimal('倒数 · 1 ÷ 0.4','DIV',['1','0.4'],'2.5','把 1 除以第二个参数，可编辑第二个参数求其他数的倒数。'),
    advancedDecimal('开根号 · √2','SQRT',['2'],'≈ 1.414','反复取当前估计与「输入除以当前估计」的平均值，得到非负实数平方根的近似值。可点「快速求值」。'),
    advancedDecimal('正弦 · sin(0.5)','SIN',['0.5'],'≈ 0.479',angleNote),
    advancedDecimal('余弦 · cos(0.5)','COS',['0.5'],'≈ 0.877',angleNote),
    advancedDecimal('正切 · tan(0.5)','TAN',['0.5'],'≈ 0.546',angleNote),
    advancedDecimal('双曲正弦 · sinh(−0.5)','SINH',['-0.5'],'≈ -0.521',hyperbolicNote),
    advancedDecimal('双曲余弦 · cosh(0.5)','COSH',['0.5'],'≈ 1.127',hyperbolicNote),
    advancedDecimal('双曲正切 · tanh(0.5)','TANH',['0.5'],'≈ 0.462',hyperbolicNote)
  );
  const levels = [
    { id:1, name:'原样返回', topic:'恒等函数', description:'让恒等函数接收一个函数，看看它如何把输入原样返回。', start:'(λx.x) (λy.y)', target:I, targetLabel:'I · 恒等函数', hint:'λx.x 会把参数直接返回。点击「单步」，观察 x 被整个参数替换。' },
    { id:2, name:'选择第一个', topic:'布尔值', description:'两个函数交给 TRUE；归约后应只留下第一个。', start:`(${TRUE}) (${I}) (${TRUE})`, target:I, targetLabel:'I · 恒等函数', hint:'λx.λy.x 接收两个参数，只保留第一个。第二个参数可以是任意式。' },
    { id:3, name:'翻转真假', topic:'函数组合', description:'将 TRUE 交给 NOT，观察取反后函数的行为。', start:`(λb.b (${FALSE}) (${TRUE})) (${TRUE})`, target:FALSE, targetLabel:'FALSE · 选择第二个', hint:'布尔值本身是一个选择器。NOT 把 FALSE 放在第一位，把 TRUE 放在第二位。' },
    { id:4, name:'再走一步', topic:'Church 数', description:'将 2 交给后继函数，归约到没有可归约项。', start:`(${SUCC}) (${TWO})`, target:THREE, targetLabel:'Church 数字 3', hint:'数字 n 表示重复 n 次。「加一」会在 n 次作用之外，再套上一层 f。' },
    { id:5, name:'让函数相加', topic:'Church 加法', description:'不用宿主语言的数字运算，只靠函数计算 2 + 3。', start:`(${ADD}) (${TWO}) (${THREE})`, target:FIVE, targetLabel:'Church 数字 5', hint:'m f (n f x)：先把 f 作用 n 次，再继续作用 m 次。运行到正规形后验证答案。' },
    { id:6, name:'组合子的配合', topic:'S K K', description:'将两个 K 组合子交给 S，找出最终得到的函数。', start:`(λx y z.(x z) (y z)) (${TRUE}) (${TRUE})`, target:I, targetLabel:'I · 恒等函数', hint:'先把两个 K 代入 S，追踪它们如何接收同一个参数。即使外层已经是 λ，也要继续归约函数体。' },
    { id:7, name:'交换参数', topic:'组合子 C', description:'交换 TRUE 的两个输入，从 2 和 3 中选出原来的第二项。', start:`(λf x y.f y x) (${TRUE}) 2 3`, target:'3', targetLabel:'Church 数字 3', hint:'先代入 f=TRUE，再跟踪两个输入在交换后的位置。暂时不要展开输入数字。' },
    { id:8, name:'连续加一', topic:'组合子 B', description:'把两个加一函数串起来，将 1 作为最初输入。', start:`(λf g x.f (g x)) (${SUCC}) (${SUCC}) 1`, target:'3', targetLabel:'Church 数字 3', hint:'B f g x = f (g x)。先计算里面的加一，再计算外面的加一。' },
    { id:9, name:'深入函数内部', topic:'λ 内部归约', description:'外层没有参数可接收，函数体里面仍然可以继续归约。', start:'λz.(λx.x) z', target:I, targetLabel:'I · 恒等函数', hint:'外层 λ 没有参数也能继续归约。先找到 λz 内部的应用，再用它的参数替换绑定变量。' },
    { id:10, name:'保护自由变量', topic:'避免变量捕获', description:'把自由变量 y 传入一个含有 λy 的函数，保留它的自由身份。', start:'(λx.λy.x) y', target:'λz.y', targetLabel:'返回自由变量 y', hint:'先把内部绑定的 y 改名，再替换 x。检查原本自由的 y 是否仍然自由，避免被内部 λ 捕获。' },
    { id:11, name:'两者都为真', topic:'布尔 AND', description:'计算 TRUE 与 FALSE 的逻辑与，观察两个选择器的配合。', start:`(λp q.p q p) (${TRUE}) (${FALSE})`, target:FALSE, targetLabel:'FALSE · 假', hint:'p 为真时选择 q；p 为假时保留 p。这里只有一个输入为真。' },
    { id:12, name:'有一个为真', topic:'布尔 OR', description:'计算 FALSE 与 TRUE 的逻辑或，观察第一个选择器选中了哪个分支。', start:`(λp q.p p q) (${FALSE}) (${TRUE})`, target:TRUE, targetLabel:'TRUE · 真', hint:'p 为假时选择 q。先确定被选择的分支，再继续归约该分支。' },
    { id:13, name:'布尔取反', topic:'布尔 NOT', description:'对 FALSE 取反，观察最终函数如何选择参数。', start:`(λb.b (${FALSE}) (${TRUE})) (${FALSE})`, target:TRUE, targetLabel:'TRUE · 真', hint:'取反函数把两个候选分支交换了位置。观察 FALSE 会选中哪个分支，再继续归约。' },
    { id:14, name:'取出第一项', topic:'有序对', description:'将 2 和 5 保存在函数里，再取出第一项。', start:`(${PAIR}) 2 5 (${TRUE})`, target:'2', targetLabel:'Church 数字 2', hint:'有序对把两个值交给选择器。TRUE 选择第一项。' },
    { id:15, name:'取出第二项', topic:'有序对', description:'使用另一个选择器，从同一个有序对中取出第二项。', start:`(${PAIR}) 2 5 (${FALSE})`, target:'5', targetLabel:'Church 数字 5', hint:'FALSE 选择第二项。观察有序对如何展开为一次函数调用。' },
    { id:16, name:'重复中的重复', topic:'Church 乘法', description:'将重复 3 次的操作再重复 2 次，计算 2 × 3。', start:`(${MULT}) 2 3`, target:'6', targetLabel:'Church 数字 6', hint:'乘法 λm n f.m (n f) 把 n 次操作看成一个整体，再重复 m 次。' },
    { id:17, name:'让数字作用于数字', topic:'Church 乘方', description:'让指数 3 作用在底数 2 上，计算 2³。', start:`(${POW}) 2 3`, target:'8', targetLabel:'Church 数字 8', hint:'Church 乘方可以写成 λb e.e b。归约函数体直到再无可归约项。' },
    { id:18, name:'向后一步', topic:'Church 前驱', description:'从数字 3 中去掉一次函数作用，观察前驱函数如何实现这一步。', start:`(${PRED}) 3`, target:'2', targetLabel:'Church 数字 2', hint:'前驱借助中间状态，让最终的函数作用少执行一次。' },
    { id:19, name:'连续后退', topic:'Church 减法', description:'对 5 连续取两次前驱，计算自然数减法 5 − 2。', start:`(${SUB}) 5 2`, target:'3', targetLabel:'Church 数字 3', hint:'把前驱函数重复 2 次。此阶段使用 Church 自然数，下阶段再进入负数与小数。' },
    { id:20, name:'辨认零', topic:'零判断', description:'判断 Church 数字 0 是否为零，将结果归约成布尔选择器。', start:`(${ZERO}) 0`, target:TRUE, targetLabel:'TRUE · 真', hint:'看输入数字会让传入的操作执行几次，再观察初始选择器是否被替换。' },
    { id:21, name:'精确的小数加法', topic:'列表小数', encoding:'decimal', description:'用逐位进位计算 0.1 + 0.2，观察小数位如何对齐。长表达式可点击「快速运行」。', start:D.expression('ADD',["0.1","0.2"]),decimalOperation:'ADD',operands:["0.1","0.2"], target:'0.3', targetType:'decimal', targetLabel:'精确小数 0.3', hint:'小数点位置先对齐，再对数字列表逐位相加。快速运行仍保留全部归约步骤。' },
    { id:22, name:'跨过零', topic:'带符号减法', encoding:'decimal', description:'计算 1 − 2，让结果从自然数走到负数。', start:D.expression('SUB',["1","2"]),decimalOperation:'SUB',operands:["1","2"], target:'-1', targetType:'decimal', targetLabel:'精确小数 −1', hint:'比较两个绝对值，按较大值减较小值，然后确定负号。' },
    { id:23, name:'小数点往哪里走', topic:'列表乘法', encoding:'decimal', description:'计算 0.2 × 0.3，观察数字乘积与小数位数共同决定结果。', start:D.expression('MUL',["0.2","0.3"]),decimalOperation:'MUL',operands:["0.2","0.3"], target:'0.06', targetType:'decimal', targetLabel:'精确小数 0.06', hint:'先对数字列表做竖式乘法，再把两个输入的小数位数相加，确定结果的小数点位置。' },
    { id:24, name:'除到刚刚好', topic:'十进制长除法', encoding:'decimal', decimalPlaces:3, description:'计算 1 ÷ 8。本关预置3位小数，运行后必须得到精确结果。建议快速运行。', start:D.expression('DIV',["1","8"],3),decimalOperation:'DIV',operands:["1","8"], target:'0.125', targetType:'decimal', targetLabel:'精确小数 0.125', hint:'每一步把余数扩大十倍，再求下一位。观察余数何时归零；有近似标记的结果不能通过精确答案验证。' },
    { id:25, name:'正负相遇', topic:'带符号加法', encoding:'decimal', description:'计算 −1.2 + 0.5，保留正确符号和小数位置。', start:D.expression('ADD',["-1.2","0.5"]),decimalOperation:'ADD',operands:["-1.2","0.5"], target:'-0.7', targetType:'decimal', targetLabel:'精确小数 −0.7', hint:'符号不同的加法等价于绝对值相减；较大的绝对值来自负数。' },
    { id:26, name:'从三个里选两个', topic:'组合数', strategy:'normal', direction:'left', description:'用帕斯卡递推计算 C(3,2)，不计选择顺序。本关预设从左到右正规序。', start:`(${CHOOSE}) 3 2`, target:'3', targetLabel:'Church 数字 3', hint:`C(n,0)=1，C(0,k)=0，其余拆成两个较小的组合数。${recursiveHint}` },
    { id:27, name:'三个数的连乘', topic:'迭代阶乘', description:'用有序对保存当前数字与累积乘积，真正算出 3!。', start:`(${FACTORIAL}) 3`, target:'6', targetLabel:'Church 数字 6', hint:'从 (0,1) 开始：当前数字加一，再让累计乘积乘以这个新数字。重复更新三次，最后取出乘积。' },
    { id:28, name:'生成导函数', topic:'符号求导', description:'输入原丘奇函数 x² + 3x，在求导程序内部编码并生成导函数。',start:M.churchExpression('DIFF',M.churchFunction([0,3,1])), target:'2x + 3', targetType:'polynomial', targetLabel:'导函数 2x + 3', hint:'原函数是末尾的独立参数。编码得到降序系数 [1,3,0] 后，按原次数乘系数并去掉常数项。' },
    { id:29, name:'生成原函数', topic:'符号积分', description:'输入原丘奇函数 λx.x，在积分程序内部编码并生成原函数，积分常数取 0。',start:M.churchExpression('INTEGRATE','λx.x'), target:'1/2x²', targetType:'polynomial', targetLabel:'原函数 ½x²（C=0）', hint:'逐项让次数加一、系数除以新次数，最后追加积分常数 0。分数系数使用有理数编码。' },
    { id:30, name:'最后一关：曲线下面积', topic:'定积分', description:'输入原丘奇函数 2x 和积分上下限，程序内部编码、积分，再计算端点差。',start:M.churchExpression('DEFINITE',M.churchFunction([0,2]),'0','3'), target:'9', targetType:'rational', targetLabel:'有理数 9', hint:'三个末尾参数依次是原函数、下限、上限。先生成原函数系数，再代入端点相减。' }
  ];
  const stages=['入门五关','函数与绑定','逻辑与数据','自然数进阶','列表小数','高等数学'].map((name,index)=>({id:index+1,name,levelIds:levels.slice(index*5,index*5+5).map(l=>l.id)}));
  function sourceFor(item,precision=item.decimalPlaces??6){return item.decimalOperation?D.expression(item.decimalOperation,item.operands.map((value,index)=>item.operandEncodings?.[index]==='church'?`${value}_church`:value),precision):item.term??item.start;}
  function inputSourceFor(item,precision=item.decimalPlaces??6){return item.decimalOperation?D.expression(item.decimalOperation,item.operands.map((value,index)=>`${value}_${item.operandEncodings?.[index]??'decimal'}`),precision):sourceFor(item,precision);}
  function parametersFor(item){
    if(item.parameters)return item.parameters;
    const labels={ADD:['第一个加数','第二个加数'],DIV:['被除数','除数'],POW:['底数','指数'],SQRT:['根号内的数'],SHL:['原小数'],SHR:['原小数']}[item.decimalOperation];
    return labels?.map((label,index)=>`${label} ${item.operands[index]}_${item.operandEncodings?.[index]??'decimal'}`)??[];
  }
  const API={ examples, levels, stages, sourceFor, inputSourceFor, parametersFor, I, TRUE, FALSE, churchLists:{encode:churchList,nil:NIL,cons:CONS,head:HEAD,tail:TAIL,isEmpty:EMPTY,length:LENGTH,map:MAP,append:APPEND,reverse:REVERSE,filter:FILTER}, advanced:{factorial:FACTORIAL,recursiveFactorial:RECURSIVE_FACTORIAL,choose:CHOOSE,permutations:PERMUTATIONS,sumPowers,geometricSum:GEOMETRIC_SUM,binomial:BINOMIAL,polynomial:POLYNOMIAL,derivative:DERIVATIVE,integral:INTEGRAL} };
  root.LambdaPresets=API;
  if(typeof module !== 'undefined' && module.exports) module.exports=API;
})(typeof globalThis !== 'undefined' ? globalThis : window);
