(function(root){
  'use strict';
  const P=root.LambdaPresets||require('./presets.js');
  const Details=root.LambdaGuideDetails||require('./guide-details.js');
  const Advanced=root.LambdaGuideAdvanced||require('./guide-advanced.js');
  const Names=root.LambdaGuideNames||(typeof require==='function'?require('./guide-names.js'):null);
  const Pairs=root.LambdaGuidePairs||require('./guide-pairs.js');
  const lessons={
    '恒等函数 I':[
      'I = λx.x',
      ['函数体只有参数本身。接收一个参数后，β 归约把函数体中的 x 换成这个参数。参数可以是数字、自由变量或另一个函数。','λx.x 与 λa.a 只改变了绑定变量的名字，含义相同。'],
      '(λx.x) y → y\n(λx.x) (λa.a) → λa.a'
    ],
    'TRUE · 选择第一个':[
      'TRUE = λa.λb.a',
      ['丘奇布尔通过选择参数表示真假。TRUE 接收两个候选值，返回第一个，第二个参数没有出现在函数体里。','在正规序下，被丢弃的分支可以直接消失，因此 TRUE 也能用来写条件分支。'],
      '(λa.λb.a) p q → (λb.p) q → p'
    ],
    'FALSE / 数字 0':[
      'FALSE = λa.λb.b\n0 = λf.λx.x',
      ['FALSE 接收两个候选值并返回第二个。丘奇数 0 接收迭代函数和初值，返回未经迭代的初值。','二者经过绑定变量改名后具有相同结构。页面根据选中的数据编码解释这个结构。'],
      'FALSE p q → q\n0 f x → x'
    ],
    'Church 数字 2':[
      '2 = λf.λx.f (f x)',
      ['丘奇数 n 表示把函数 f 作用 n 次。数字本身保存的是重复执行的方式。','两个 f 的应用嵌套在一起。把 f 换成后继函数、初值设为 0，就得到普通意义上的 2。'],
      '2 f x → f (f x)\n2 SUCC 0 → SUCC (SUCC 0) → 2'
    ],
    'S K K → I':[
      'S = λf g x.(f x) (g x)\nK = λa b.a',
      ['S 把同一个参数 x 分别传给 f 和 g，再把两个结果应用起来。K 总是返回它接收的第一个参数。','S 的两个参数都取 K 时，左侧 K x 最终选择 x，右侧的 K x 被丢弃，因此组合的行为与恒等函数相同。'],
      'S K K x → (K x) (K x) → x\nS K K → λx.x'
    ],
    '加法 · 2 + 3':[
      'ADD = λm n f x.m f (n f x)',
      ['先用 n 把 f 作用在初值上，再让 m 对这个结果继续作用 f。两段重复次数相加。','表达式中的 m、n 是丘奇函数。把它们代入后，函数体中会出现 m+n 个 f。'],
      'ADD 2 3 f x → 2 f (3 f x)\n→ f (f (f (f (f x))))\n→ 5 f x'
    ],
    'Ω · 无限循环':[
      'Ω = (λx.x x) (λx.x x)',
      ['左侧函数把参数同时放在函数位置和参数位置。参数恰好也是同一个自应用函数。','执行一次 β 归约会得到与原式相同的表达式，因此没有 β 正规形。游戏确认这个重复循环后会停止自动运行，仍可手动单步查看。'],
      '(λx.x x) (λx.x x)\n→ (λx.x x) (λx.x x)\n→ …'
    ],
    '防止变量捕获':[
      '(λx.λy.x) y',
      ['实参 y 是自由变量。直接把它替换进 λy 的作用域，会把自由变量错误地变成绑定变量。','归约先把内部的绑定变量 y 改成一个没有冲突的新名字，再替换 x。结果仍然返回原来的自由变量 y。'],
      '(λx.λy.x) y\n≡ (λx.λy1.x) y\n→ λy1.y'
    ],
    '组合子 B · 连续加一 → 5':[
      'B = λf g x.f (g x)\nSUCC = λn f x.f (n f x)',
      ['B 表示函数复合，先执行 g，再把结果交给 f。x 在函数体里出现一次，沿着这两个函数依次传递。','这里的 f 和 g 都是丘奇后继。每次后继在数字的迭代体外再加一层函数应用。'],
      'B SUCC SUCC 3\n→ SUCC (SUCC 3)\n→ SUCC 4 → 5'
    ],
    '组合子 C · 交换参数 → 3':[
      'C = λf x y.f y x',
      ['C 交换函数接收到的两个参数，函数 f 的内部实现无需改变。','TRUE 选择传给它的第一个参数。交换后的第一个参数是 3，因此结果为 3。'],
      'C TRUE 2 3 → TRUE 3 2 → 3'
    ],
    '组合子 W · 复制参数 → 9':[
      'W = λf x.f x x',
      ['W 让同一个参数出现在两个位置。这里把丘奇乘法作为 f，于是两个因子都来自同一个输入。','参数复制是这个组合子的计算含义。大参数反复复制可能使逐步归约的中间表达式变大。'],
      'W MUL 3 → MUL 3 3 → 9'
    ],
    '乘法 · 2 × 3 → 6':[
      'MUL = λm n f.m (n f)',
      ['n f 表示一个会连续执行 n 次 f 的函数。m 再重复调用这个函数 m 次，总次数就是 m×n。','乘法产生的结果仍是一个丘奇数，可以继续作为加法或其他迭代的参数。'],
      'MUL 2 3 f x → 2 (3 f) x\n→ (3 f) ((3 f) x)\n→ f (f (f (f (f (f x)))))'
    ],
    '乘方 · 2⁴ → 16':[
      'POW = λbase exponent.exponent base',
      ['指数是一个迭代器。让指数迭代底数这个丘奇函数，会把函数重复次数逐层相乘。','参数顺序是底数、指数。此例的 4 在程序内部作用于 2，形成 2 的四次方。'],
      'POW 2 4 → 4 2\n2⁴ = 2 × 2 × 2 × 2 = 16'
    ],
    '前驱 · 3 − 1 → 2':[
      'PRED = λn f x.n (λg h.h (g f)) (λu.x) (λu.u)',
      ['前驱用延迟应用保存上一次计算。初始函数 λu.x 忽略第一次收到的 f，因此第一次迭代只建立状态，没有增加结果。','后续迭代才逐次补上 f。最后传入恒等函数取出结果，总共留下 n−1 次应用。输入 0 时也返回 0。'],
      'PRED 3 f x → f (f x)\nPRED 1 f x → x\nPRED 0 f x → x'
    ],
    '减法 · 5 − 2 → 3':[
      'SUB = λm n.n PRED m',
      ['第二个丘奇数决定对第一个数执行多少次前驱。每执行一次，数字减一。','丘奇自然数没有负数。由于 0 的前驱仍为 0，减法在结果小于 0 时截断为 0。'],
      'SUB 5 2 → 2 PRED 5\n→ PRED (PRED 5) → 3\nSUB 2 5 → 0'
    ],
    '零判断 · 0 = 0 → TRUE':[
      'ISZERO = λn.n (λx.FALSE) TRUE',
      ['先把初值设为 TRUE。输入 0 不执行迭代，因此保留 TRUE。','正数至少执行一次 λx.FALSE，第一次就把结果改成 FALSE，后续迭代继续返回 FALSE。'],
      'ISZERO 0 → TRUE\nISZERO 3 → (λx.FALSE) (…) → FALSE'
    ],
    '比较 · 2 ≤ 3 → TRUE':[
      'LE = λm n.ISZERO (SUB m n)',
      ['自然数减法在 m≤n 时返回 0，在 m>n 时留下正数。对差做零判断，就得到“小于等于”。','顺序不能交换。LE 2 3 检查 2−3，LE 3 2 检查 3−2。'],
      'LE 2 3 → ISZERO (SUB 2 3) → ISZERO 0 → TRUE\nLE 3 2 → ISZERO 1 → FALSE'
    ],
    '有序对 · 读取 (3, 5) 的第二项 → 5':[
      'PAIR = λa b selector.selector a b\nFIRST = λp.p TRUE\nSECOND = λp.p FALSE',
      ['有序对保存两个参数，等待调用者提供选择器。把 TRUE 传给它会选择第一项，把 FALSE 传给它会选择第二项。','这让多项状态也能装在一个 λ 值中，供阶乘、前驱和除法等迭代函数使用。'],
      'PAIR 3 5 FALSE\n→ FALSE 3 5 → 5'
    ],
    '阶乘 · 迭代计算 3! → 6':[
      'state = PAIR 当前数字 累计乘积\nstep (k, product) = (k+1, (k+1)×product)',
      ['从当前数字 0、乘积 1 开始，让丘奇输入 n 重复执行一次状态更新。一次更新同时增加当前数字并更新乘积。','每一轮都使用新数字乘旧乘积，因此依次乘上 1、2、…、n。最后取出有序对的第二项。'],
      '(0,1) → (1,1) → (2,2) → (3,6)\n取第二项 → 6\n0! 保留初值 1'
    ],
    '阶乘 · Y 递归计算 3! → 6':[
      'Y = λf.(λx.f (x x)) (λx.f (x x))\nFAC = Y (λrecur n.ISZERO n 1 (MUL n (recur (PRED n))))',
      ['递归体把自身作为参数 recur 接收。Y 满足 Y F → F (Y F)，因此函数体可以通过 recur 再调用自己。','正规序先做零判断。输入到 0 时选择 1，丢弃继续递归的分支。应用序可能先展开递归分支，无法到达终止判断。'],
      'FAC 3 → 3 × FAC 2\n→ 3 × 2 × FAC 1\n→ 3 × 2 × 1 × FAC 0\n→ 6'
    ],
    '组合数 · C(4, 2) → 6':[
      'C(n,k) = C(n−1,k−1) + C(n−1,k)\nC(n,0)=1，C(0,k>0)=0',
      ['把选择方案按是否选中某个指定元素分成两类。选中它后，还需要从剩余元素选 k−1 个；未选中它时，仍需选 k 个。','λ 程序用 Y 实现这两个递归分支，再用丘奇加法相加。k 为 0 的终止条件先判断，保证 C(0,0)=1。'],
      'C(4,2) = C(3,1) + C(3,2)\n= 3 + 3 = 6'
    ],
    '斐波那契 · F(5) → 5':[
      'fibonacci = Y (λrecur n.ISZERO n 0 (ISZERO (PRED n) 1 (ADD (recur (PRED n)) (recur (PRED (PRED n))))))',
      ['函数先判断 n 是否为 0，再判断 n 的前驱是否为 0，从而识别两个起始值。其他情况递归计算前两项并相加。','这个示例直接使用递归定义，同一子问题可能被多次计算。较大输入可以使用快速求值复用被共享的参数。'],
      'F(5)=F(4)+F(3)\nF(4)=2+1=3，F(3)=1+1=2\nF(5)=3+2=5'
    ],
    '排列数 · A(4, 2) → 12':[
      'state=(剩余可选数, 累计乘积)\nstep (n,p)=(n−1,n×p)',
      ['每选一次，当前可选数量减少一。k 次选择对应 n×(n−1)×…×(n−k+1)。','丘奇 k 控制状态更新次数。累计乘积从 1 开始，所以选择 0 个元素时结果是 1；超过 n 次后会乘上 0。'],
      '(4,1) → (3,4) → (2,12)\n取累计乘积 → 12'
    ],
    '自然数求和 · 1 + … + 5 → 15':[
      'state=(当前下标, 累计和)\nstep (k,s)=(k+1,s+(k+1))',
      ['用一个有序对同时保存下标与总和。每次先增加下标，再把新下标加入累计和。','丘奇输入决定更新次数。输入 0 时没有更新，返回空和 0。'],
      '(0,0) → (1,1) → (2,3) → (3,6)\n→ (4,10) → (5,15)'
    ],
    '平方和 · 1² + 2² + 3² → 14':[
      'step (k,s)=(k+1,s+(k+1)²)',
      ['与自然数求和使用相同的下标和累计值状态，但加入总和前先对新下标求平方。','程序用丘奇乘方计算每一项，再使用丘奇加法累计。末尾参数指定求和上界。'],
      '(0,0) → (1,1) → (2,5) → (3,14)\n1²+2²+3²=1+4+9=14'
    ],
    '立方和 · 1³ + 2³ + 3³ → 36':[
      'step (k,s)=(k+1,s+(k+1)³)',
      ['迭代状态保存当前下标和立方和。每次更新先求下一个数字的三次方，再加到总和。','这里逐项执行乘方和相加。输入为 0 时保留累计值 0。'],
      '(0,0) → (1,1) → (2,9) → (3,36)\n1³+2³+3³=1+8+27=36'
    ],
    '等比求和 · 1 + 2 + 4 + 8 → 15':[
      'state=(当前项, 累计和)\nstep (term,sum)=(base×term,sum+term)',
      ['当前项从 1 开始。每轮先把旧的当前项加入总和，同时把当前项乘以公比，准备下一轮。','第二个输入是项数，因此求和包含 b⁰ 到 bⁿ⁻¹。项数为 0 时返回 0。'],
      '(1,0) → (2,1) → (4,3) → (8,7) → (16,15)\n返回累计和 15'
    ],
    '二项式系数和 · C(3,0) + … + C(3,3) → 8':[
      'Σ C(n,k)·1^(n−k)·1^k，k=0…n',
      ['这是二项式展开程序把两个底数都设为 1 的情形。每个幂都等于 1，只留下组合数。','程序仍逐项计算 C(n,k) 并累加。下标从 0 到 n，包括两个端点。'],
      'C(3,0)+C(3,1)+C(3,2)+C(3,3)\n=1+3+3+1=8'
    ],
    '二项式展开 · (1 + 2)³ → 27':[
      '(a+b)^n = Σ C(n,k)·a^(n−k)·b^k',
      ['有序对保存下标 k 和累计结果。每一步用递归组合数、两个丘奇乘方和乘法求出一项。','程序执行 n+1 轮，覆盖 k=0 到 k=n。三个末尾参数分别是 a、b、n。'],
      '(1+2)³\n=1×1³×2⁰ + 3×1²×2¹ + 3×1¹×2² + 1×1⁰×2³\n=1+6+12+8=27'
    ],
    '多项式 · 2x² + 3x + 1，x=2 → 15':[
      'λfunction x.evalpoly (encodepoly function) x\np(x)=(2x+3)x+1',
      ['原函数使用普通丘奇数加法和乘法。内部编码器先算 s=f(1)，选择 b=s+1，再把 f(b) 按 b 进制拆位，恢复降序系数。自然数系数都小于 b，因此不会互相进位。','求值使用 Horner 方法，从最高次系数开始反复执行“累计值乘 x，再加下一项系数”。系数用有理数对表示，输入函数是末尾的独立参数。'],
      'f(1)=6，b=7\nf(7)=120=2×7²+3×7+1 → [2,3,1]\nx=2 时，(2×2+3)×2+1=15'
    ],
    '符号求导并求值 · (x² + 3x)′，x=2 → 7':[
      'λfunction x.evalpoly (diff (encodepoly function)) x\n(a·xⁿ)′=(n·a)·xⁿ⁻¹',
      ['程序先在内部将原丘奇函数转换成降序系数，再把每项系数乘以原次数，并去掉常数项。得到的仍是一个多项式列表。','随后把新列表交给 Horner 求值。这样输入参数同时决定原函数和代入点。输入函数需为自然数系数多项式。'],
      'x²+3x → 系数 [1,3,0]\n求导 → [2,3] → 2x+3\n代入 2 → 2×2+3=7'
    ],
    '定积分 · ∫₀³ 2x dx → 9':[
      '∫ₐᵇ f(x)dx = F(b)−F(a)\n∫ a·xⁿ dx = a/(n+1)·xⁿ⁺¹',
      ['积分函数内部先编码原丘奇函数，再按幂规则把每项次数加一、系数除以新次数。追加的积分常数取 0。','用有理数对保存除法后的系数，再分别计算上限和下限。当前端点使用自然数，要求下限不大于上限。'],
      '原函数输入 f(x)=2x → 系数 [2,0]\n生成 F(x)=x²\nF(3)−F(0)=9−0=9'
    ],
    '生成导函数 · x² + 3x → 2x + 3':[
      'λfunction.diff (encodepoly function)',
      ['输入是普通丘奇多项式函数。编码在求导程序内部完成，结果表示原函数的降序系数。','右折叠从常数项开始，状态保存当前次数和新系数列表。次数为 0 时跳过常数，其他项把系数乘次数并加入结果。'],
      '原函数 x²+3x → [1,3,0]\n常数 0 去掉，3×1=3，1×2=2\n新系数 [2,3] → 2x+3'
    ],
    '生成原函数 · 2x → x²（C=0）':[
      'λfunction.integ (encodepoly function)',
      ['输入原丘奇函数后，程序内部编码并遍历每个系数。原次数为 n 的项，系数除以 n+1，次数升为 n+1。','结果系数用分子、分母有序对保存，可以精确保留 1/2 等分数。最后追加 0 作为积分常数。'],
      '2x → [2,0] → [2/2,0/1,0] → x²\nx → [1,0] → [1/2,0,0] → 1/2x²'
    ],
    '丘奇列表 · 空表 []':[
      'NIL = λc n.n',
      ['丘奇列表接收组合函数 c 和末尾初值 n。空表没有任何元素，因此直接返回初值。','这个结构与 FALSE、丘奇数 0 相同。选择列表编码后，页面会把它显示为空列表。'],
      '[] c n → n\n[] ADD 0 → 0'
    ],
    '丘奇列表 · 头部插入 1 → [1, 2, 3]':[
      'CONS = λhead tail c n.c head (tail c n)',
      ['旧列表先折叠成 tail c n，新的元素在外面多执行一次 c。列表的顺序由这些 c 的嵌套次序保存。','元素本身也是 λ 数据，既可以是丘奇数，也可以是函数或另一个列表。'],
      'CONS 1 [2,3] c n\n→ c 1 (c 2 (c 3 n))\n→ [1,2,3] c n'
    ],
    '丘奇列表 · 首项 HEAD → 1':[
      'HEAD = λlist default.list (λhead rest.head) default',
      ['折叠函数忽略后缀，只返回当前位置的元素。最外层调用对应第一个元素，因此它成为最终结果。','空表不会调用折叠函数，直接返回第二个参数 default。'],
      'HEAD [1,2,3] 0\n→ (λhead rest.head) 1 (…) → 1\nHEAD [] 0 → 0'
    ],
    '丘奇列表 · 尾部 TAIL → [2, 3]':[
      'state=(当前完整后缀, 去掉首项的后缀)',
      ['从右边折叠列表，用有序对保存两份相邻后缀。处理新元素时，第一项在旧完整后缀前插入该元素，第二项保存旧完整后缀。','遍历结束后取第二项，就得到整个列表去掉首元素的结果。初始状态的两项都是空表。'],
      '([],[]) → ([3],[])\n→ ([2,3],[3]) → ([1,2,3],[2,3])\n取第二项 → [2,3]'
    ],
    '丘奇列表 · 判空 [] → TRUE':[
      'EMPTY = λlist.list (λhead rest.FALSE) TRUE',
      ['初值设为 TRUE，每遇到一个元素就返回 FALSE。空列表没有元素，初值可以直接成为结果。','判断过程只关心有没有元素，不需要分析每个元素的内容。'],
      'EMPTY [] → [] (λhead rest.FALSE) TRUE → TRUE'
    ],
    '丘奇列表 · 判空 [1, 2, 3] → FALSE':[
      'EMPTY = λlist.list (λhead rest.FALSE) TRUE',
      ['非空列表至少执行一次组合函数。这个函数忽略元素和后缀，并选择 FALSE。','正规序中只要外层确认存在首元素，就可以丢弃后面的计算。'],
      'EMPTY [1,2,3]\n→ (λhead rest.FALSE) 1 (…) → FALSE'
    ],
    '丘奇列表 · 长度 LENGTH → 3':[
      'LENGTH = λlist.list (λhead count.SUCC count) 0',
      ['从丘奇数 0 开始折叠。每个元素都让累计长度增加一次，元素自身由忽略它的参数 head 接收。','结果是丘奇自然数，可以直接参与后续加法或作为迭代次数。'],
      'LENGTH [1,2,3]\n→ SUCC (SUCC (SUCC 0)) → 3'
    ],
    '丘奇列表 · 映射 MAP 加一 → [2, 3, 4]':[
      'MAP = λf list c n.list (λhead rest.c (f head) rest) n',
      ['映射在重建列表时，对每个元素调用传入的函数 f。尾部 rest 保留原来的相对顺序。','这里传入丘奇后继，所以每一项都增加一次函数应用。空列表经过映射仍为空列表。'],
      'MAP SUCC [1,2,3]\n→ [SUCC 1,SUCC 2,SUCC 3]\n→ [2,3,4]'
    ],
    '丘奇列表 · 拼接 APPEND → [1, 2, 3]':[
      'APPEND = λa b c n.a c (b c n)',
      ['先把第二个列表折叠到末尾初值上，再把这个结果作为第一个列表的新末尾。','第一个列表中元素的顺序保持原样，它们的尾部最终接上第二个列表。'],
      'APPEND [1,2] [3] c n\n→ c 1 (c 2 (c 3 n))'
    ],
    '丘奇列表 · 反转 REVERSE → [3, 2, 1]':[
      'REVERSE = λlist.list (λhead rest accumulator.rest (CONS head accumulator)) I NIL',
      ['每个折叠步骤产生一个接收累计列表的函数。它把当前元素插到累计列表前面，再交给下一段函数。','从空列表开始执行这些函数时，先前出现的元素逐次被后来的元素挤到后面，因而完成反转。'],
      '累计值 [] → [1] → [2,1] → [3,2,1]'
    ],
    '丘奇列表 · 折叠求和 → 6':[
      'sumlist = λlist.list ADD 0',
      ['丘奇列表本身就是右折叠，列表的第一个参数决定如何把一个元素与后缀结果组合，第二个参数是空表的结果。','这里用 ADD 作为组合函数，用 0 作为末尾初值，所以所有元素逐项相加。'],
      'ADD 1 (ADD 2 (ADD 3 0))\n→ ADD 1 (ADD 2 3) → 6'
    ],
    '丘奇列表 · 折叠乘积 → 6':[
      'productlist = λlist.list MUL 1',
      ['把右折叠的组合函数换成 MUL，就能计算乘积。末尾初值需要是乘法单位元 1。','因此空列表的乘积为 1；只要列表中出现 0，最终乘积就是 0。'],
      'MUL 1 (MUL 2 (MUL 3 1))\n→ 1×2×3×1 → 6'
    ],
    '丘奇列表 · 过滤 FILTER 去零 → [2, 3]':[
      'FILTER = λpredicate list c n.list (λhead rest.predicate head (c head rest) rest) n',
      ['对每个元素执行布尔谓词。返回 TRUE 时把元素加入结果，返回 FALSE 时直接使用后缀结果。','示例谓词对零返回 FALSE、对正数返回 TRUE。每个被保留元素都保持原来的次序。'],
      '[0,2,0,3]\n→ 丢弃 0，保留 2，丢弃 0，保留 3\n→ [2,3]'
    ],
    '超幂 · 2 ↑↑ 3 → 16':[
      'TETRATION = λbase height.height (POW base) 1',
      ['超幂把幂运算继续迭代。从 1 开始，每一步把上一轮结果作为指数，计算以 base 为底的新幂。','幂塔按右结合解释。丘奇高度控制迭代次数，高度为 0 时返回 1。'],
      '高度 0 → 1\n高度 1 → 2¹=2\n高度 2 → 2²=4\n高度 3 → 2⁴=16'
    ],
    '超超幂 · 2 ↑↑↑ 2 → 4':[
      'PENTATION = λbase count.count (TETRATION base) 1',
      ['把上一层的超幂当作更新函数反复调用。每次使用上一轮结果作为新幂塔的高度。','输入次数为 0 时返回初值 1；次数增加时，中间数字和表达式都可能迅速变大。'],
      '初值 1 → 2 ↑↑ 1=2\n→ 2 ↑↑ 2=4'
    ],
    '开根号 · √10 向下取整 → 3':[
      '寻找最大的 k，使 k^degree ≤ target',
      ['从正整数底数开始递增搜索。每次用丘奇乘方求候选幂值，并与目标比较。','候选值超过目标后返回前一个底数，所以结果是向下取整的根。比较用 Scott 列表作为有限消耗的标记，目标被超过时可以提早返回。根指数 0 返回 I。'],
      '1²=1≤10，2²=4≤10，3²=9≤10\n4²=16>10 → 返回 3'
    ],
    '整数除法 · 7 ÷ 2 → 3':[
      '寻找最大的 q，使 divisor×q ≤ dividend',
      ['这个示例用单调搜索求自然数商。商从 0 开始，每次把候选商乘以除数，与被除数比较。','第一次超过被除数时返回上一个商。除数 0 在搜索前由零判断返回错误。小数商需要使用列表小数的长除法。'],
      '2×0=0，2×1=2，2×2=4，2×3=6\n2×4=8>7 → 商为 3'
    ],
    '对数 · log₂ 9 向下取整 → 3':[
      '寻找最大的 e，使 base^e ≤ target',
      ['固定底数，递增搜索指数。每个候选指数通过丘奇乘方得到幂，再与目标比较。','返回最后一个没有超过目标的指数。这里需要底数至少为 2、目标至少为 1，使搜索对应递增序列；无效输入返回 I。'],
      '2⁰=1，2¹=2，2²=4，2³=8≤9\n2⁴=16>9 → 返回 3'
    ],
    '超对数 · 2 ↑↑ h = 16 → h = 3':[
      '寻找最大的 h，使 base ↑↑ h ≤ target',
      ['固定底数，递增搜索幂塔高度。每次调用超幂程序，然后比较幂塔值与目标。','结果是高度的向下取整逆运算。底数至少为 2、目标至少为 1；无效输入返回 I。'],
      '2 ↑↑ 0=1，2 ↑↑ 1=2\n2 ↑↑ 2=4，2 ↑↑ 3=16\n下一高度超过 16 → 返回 3'
    ],
    '超根号 · b ↑↑ 2 = 4 → b = 2':[
      '寻找最大的 b，使 b ↑↑ height ≤ target',
      ['高度作为固定参数，搜索的变量是正整数底数。每次以候选底数构造指定高度的幂塔。','返回最后一个没有超过目标的底数。高度为 0 时所有底数都得到 1，因此这个示例把它作为无效输入并返回 I。'],
      '高度固定为 2\n1 ↑↑ 2=1，2 ↑↑ 2=4\n3 ↑↑ 2=27>4 → 返回 2'
    ],
    '超超根号 · b ↑↑↑ 2 = 4 → b = 2':[
      '寻找最大的 b，使 b ↑↑↑ count ≤ target',
      ['固定超超幂的迭代次数，通过递增底数进行单调搜索。候选值由超超幂程序实际计算。','每次比较超过目标就结束搜索并返回前一个底数。次数为 0 时返回 I。'],
      '次数固定为 2\n1 ↑↑↑ 2=1，2 ↑↑↑ 2=4\n3 ↑↑↑ 2 超过 4 → 返回 2'
    ],
    '超超对数 · 2 ↑↑↑ h = 4 → h = 2':[
      '寻找最大的 h，使 base ↑↑↑ h ≤ target',
      ['固定底数，搜索超超幂需要重复多少次才能到达目标附近。每次候选值都由内层超幂迭代产生。','输入目标不一定恰好落在这个序列上，程序返回最后一个不超过它的次数。无效底数或零目标返回 I。'],
      '2 ↑↑↑ 0=1，2 ↑↑↑ 1=2\n2 ↑↑↑ 2=4，下一项超过 4\n返回 2'
    ],
    '序对除法 · 7 ÷ 2 → 商 3，余数 1':[
      'state=(剩余量, 商)\n剩余量≥除数时，更新为 (剩余量−除数, 商+1)',
      ['有序对从被除数和商 0 开始。每轮先判断是否还能减去一个除数，再同时更新剩余量和商。','丘奇被除数提供足够的迭代次数。剩余量不足时状态保持不变，最后输出余数和商，并附加供页面识别的 TRUE 标记。除数 0 提前返回错误。'],
      '(7,0) → (5,1) → (3,2) → (1,3)\n1<2，后续保持 (1,3)\n余数 1，商 3'
    ]
  };
  const decimalLessons={
    ADD:['先按较大的小数位数补零对齐。符号相同就逐位相加并传递进位；符号不同则比较绝对值，用较大者减较小者并选择结果符号。','0.1+0.2\n→ 对齐为 1/10 和 2/10\n→ 数字相加为 3，位数仍为 1\n→ 0.3'],
    SUB:['先翻转第二个参数的符号，再复用带符号加法。减去负数等价于加正数；结果为零时符号归为正。','1−2 → 1+(−2)\n→ 比较绝对值并计算 2−1\n→ −1'],
    MUL:['逐个数位计算部分乘积，并按数位位置补零后相加。结果的小数位数等于两个输入的小数位数之和，负号由两个符号的异或决定。','0.2×0.3\n→ 整数数字 2×3=6\n→ 小数位数 1+1=2\n→ 0.06'],
    DIV:['先对齐输入的小数位数，把除数和被除数变成同一单位的整数数位。长除法每次带下一位进入余数，用重复减法求商位；需要小数位时继续带入零。','1÷8\n整数商为 0，余数 1\n10÷8 → 商位 1，余数 2\n20÷8 → 商位 2，余数 4\n40÷8 → 商位 5，余数 0\n→ 0.125'],
    NEG:['保留绝对值、位数和近似标记，只翻转符号位。构造函数会检查零值并清除零的负号。','1.25 → 符号由正变负 → −1.25\n0 → 0'],
    ABS:['保留数位列表、小数位数与近似标记，把符号位设为正。它既能接收正数，也能接收负数和零。','−2.75 → 清除负号 → 2.75'],
    POW:['指数使用丘奇自然数，决定重复多少次带符号小数乘法。累计值从 1 开始，每轮把底数乘入；中间结果先归约成小数数据再继续。','(−0.5)³\n累计值 1 → −0.5 → 0.25 → −0.125\n指数为 0 时返回 1'],
    SHL:['把原数位列表与自身相加，小数位数保持不变，等于乘以 2。操作只接收一个小数，可以用丘奇数在外面重复调用。','−1.25 → −2.5\n3_church SHIFT_LEFT 1.25_decimal\n表示连续左移三位，得到 10'],
    SHR:['有限十进制数除以 2，可以把数位整数乘以 5，同时把小数位数增加 1。这里每次只移动一位，所有数位都会保留。','1.25 = 125/100\n→ 625/1000 = 0.625\n连续右移三次等于除以 8'],
    SQRT:['从输入值和 1 中较大者开始，用牛顿迭代更新估计值。每轮计算“原数除以当前估计”，再与当前估计求平均，工作值截断到 4 位小数；估计不再下降时结束。','求 √2\n2 → (2+2/2)/2=1.5\n→ (1.5+2/1.5)/2≈1.4166\n→ … → 页面显示 ≈1.414'],
    SIN:['先利用奇对称性记录输入符号，再按 2π 周期缩小绝对角度，并把角度折回适合近似的小区间。使用 sin 的奇次泰勒多项式，必要时借用余弦多项式。','sin(0.5)\n≈ 0.5−0.5³/6+0.5⁵/120−0.5⁷/5040\n→ ≈0.479'],
    COS:['利用 cos(x)=sin(x+π/2)，先把输入平移半个 π，再进入与正弦相同的周期缩减和多项式近似流程。','cos(0.5)=sin(0.5+π/2)\n→ 周期与对称性缩减\n→ ≈0.877'],
    TAN:['分别计算正弦和余弦，再对二者做带符号小数除法。分母按工作位数截断；截断后为零时返回除零错误。','tan(0.5)=sin(0.5)/cos(0.5)\n≈0.4794/0.8776\n→ ≈0.546'],
    SINH:['双曲正弦使用奇次泰勒多项式，各项系数为正，因此与正弦交替正负的系数不同。负输入通过奇次项保留负号。','sinh(−0.5)\n≈ −0.5+(−0.5)³/6+(−0.5)⁵/120+…\n→ ≈−0.521'],
    COSH:['双曲余弦使用偶次泰勒多项式，从常数项 1 开始，各项相加。因为只有偶次幂，正负输入的结果相同。','cosh(0.5)\n≈1+0.5²/2+0.5⁴/24+0.5⁶/720+…\n→ ≈1.127'],
    TANH:['先计算双曲正弦和双曲余弦，再做小数除法。这里继承双曲多项式的输入范围和工作精度。','tanh(0.5)=sinh(0.5)/cosh(0.5)\n≈0.521/1.127\n→ ≈0.462']
  };
  function rawLesson(example,precision=6){
    if(example.metaInterpreter){
      const C=root.LambdaCore||require('./core.js'),Meta=root.LambdaMeta||require('./meta-lambda.js');
      const input=C.parse(example.metaInput),stages=Meta.stages(input);
      const meanings={bound:'绑定变量节点，保存从当前位置向外数的绑定深度。',freeTerm:'自由变量节点，保存自由变量环境中的下标。',abs:'抽象节点，保存函数体语法。',app:'应用节点，保存函数与参数的语法。',get:'按丘奇下标读取Scott环境中的值。',cons:'把一个值压入环境，供变量下标读取。',nil:'空环境。',closure:'解释器中的函数闭包，保存函数体的求值过程。',neutral:'不能继续执行的自由变量或中性应用。',evalTerm:'按环境解释四类语法节点。',reify:'把闭包和中性值还原成已归约的语法数据。',normalize:'先解释语法，再还原为语法正规形。',decode:'把语法数据还原为普通λ表达式；绑定变量查局部环境，自由变量查输入环境。'};
      return {
        core:'interpret = '+Meta.mainSource,
        symbols:Meta.definitions.map(definition=>({...definition,meaning:meanings[definition.name]??'供主函数使用的丘奇运算或不动点定义。'})),featured:['normalize','decode','evalTerm','reify'],
        inputs:[{name:'freeenv',value:'[y]',encoding:'Scott值环境',role:'保存自由变量y本身，供输出还原时读取'},{name:'input',value:example.metaInput,encoding:'编码后的四分支语法树',role:'生成器先编码这个普通λ表达式，随后交给主函数'}],
        basics:['先区分表达式和表达式的语法数据。λx.x是函数；“抽象节点，里面是绑定变量0”则是描述这个函数的数据。','绑定变量用距离最近绑定的下标表示，所以改名不会改变它所指的绑定。自由变量单独放进值环境，避免被新λ意外捕获。'],
        foundation:'bound = λi b f l a.b i\nfreeTerm = λi b f l a.f i\nabs = λbody b f l a.l body\napp = λp q b f l a.a p q',
        principle:['生成器遍历输入的变量、抽象、应用，把它们编码成四种λ构造器。这里只转换语法，不先算出答案。','主函数先用normalize在语法数据上执行解释，再用decode把结果还原成可继续应用的普通λ式。最后的还原也在λ程序中执行，页面无需把语法节点另行拼成表达式。'],
        overview:'普通表达式先编码；主函数执行解释；λ解码器输出普通表达式。示例的自由变量y在整个过程中保持自由。',
        flow:{columns:['阶段','传递的内容','负责什么'],rows:[['输入编码',example.metaInput,'生成器转换语法节点，不执行β求值'],['主函数','normalize input','用λ环境解释器计算语法正规形'],['输出还原','decode freeenv nil 结果语法','在λ程序内部重建变量、函数和应用'],['最终结果','λz.y','普通表达式，可接着应用其他参数']]},
        steps:[
          ['先编码输入','本例把两个抽象、一次应用和变量分别编码。绑定变量用下标，自由变量y用自由环境下标0。',C.format(stages.encoded)],
          ['把编码交给主函数','自由环境含y这个真实变量值。主函数的参数顺序是环境、编码后的输入。','interpret freeenv input → decode freeenv nil (normalize input)'],
          ['主函数执行解释','evalTerm按环境解释语法。进入抽象时构造闭包，应用闭包时把实参压入环境；变量通过下标查回对应值。','normalize = λterm.reify (evalTerm nil term) 0'],
          ['把结果语法还原成普通λ式','decode处理绑定、自由、抽象、应用四个分支。抽象分支真的生成λ，应用分支真的应用两个已还原的子式。','decode = '+Meta.definitions.find(definition=>definition.name==='decode').source],
          ['读取最终结果','结果是一个返回自由变量y的函数。绑定变量名称可以改变，y的自由身份保持不变。','(λx.λy.x) y → λz.y']
        ],
        walkthrough:'输入表达式 → 编码后的语法 → normalize → decode → 普通λ表达式',
        encodingText:'语法树使用四分支λ编码，运行环境使用Scott列表；最后输出普通λ表达式，不附带解释器结果标记。',
        parameterNote:'生成器负责输入语法编码，主函数与输出解码由生成的λ程序执行。可用自由变量、当前数字编码和自定义函数作为原始输入。',
        boundaries:['使用从左到右正规序执行。原输入没有正规形时，解释器也不会凭空得到结果；现有暂停和取消功能仍可使用。','自由变量来自输入环境；不能从一个不含自由变量的闭合λ式中凭空生成一个新的自由变量。'],
        exercise:'把输入改为 (λx.x) (λy.y)，重新生成并运行；输出应直接是恒等函数。'
      };
    }
    if(example.decimalOperation){
      const [method,walk]=decimalLessons[example.decimalOperation];
      const notes=example.category==='高等小数'&&['SIN','COS','TAN'].includes(example.decimalOperation)
        ?'角度单位为弧度，当前示例输入范围为 −1000 到 1000。π、级数项数和工作精度随输出位数参数计算。'
        :['SINH','COSH','TANH'].includes(example.decimalOperation)
          ?'当前双曲函数示例输入范围为 −1 到 1。级数项数和工作精度随输出位数参数变化；近似标记仅在内部记录。'
          :example.decimalOperation==='SQRT'?'输入需为非负数，负输入会返回实数平方根定义域错误。按输出位数参数进行牛顿迭代和截断。'
            :example.decimalOperation==='DIV'?'小数位数由设置决定。结果按位数截断，近似标记仅在内部使用；除数为零返回错误。':'数位采用有限列表保存，精确四则与移位不会依赖 JavaScript 浮点数。';
      let walkthrough=walk;
      if(example.name.startsWith('带符号除法'))walkthrough='−7.5÷2 → 对齐整数单位 75÷20\n→ 长除法得到 3.75\n→ 两个输入符号不同，结果 −3.75';
      if(example.name.startsWith('倒数'))walkthrough='1÷0.4 → 同比例变成 10÷4\n→ 商为 2.5';
      return {...Details.describe(example,precision),principle:[method,notes],walkthrough,...Advanced.describe(example,precision)};
    }
    const entry=lessons[example.name];
    if(!entry)throw new Error(`Missing explanation for ${example.name}`);
    return Pairs.describe(example,{...Details.describe(example,precision),core:entry[0],principle:entry[1],walkthrough:entry[2],...Advanced.describe(example,precision)});
  }
  const namedLessons=new Map();
  function catalog(){return Names?.catalog();}
  function lesson(example,precision=6){const key=example.name+'\0'+precision;if(!namedLessons.has(key)){const raw={...rawLesson(example,precision),purpose:example.description??''};namedLessons.set(key,catalog()?.normalize(raw,example.name)??raw);}return namedLessons.get(key);}
  function titleFor(example){return lesson(example).displayTitle??example.name;}
  function init(api){
    const $=id=>document.getElementById(id),category=$('guide-category'),search=$('guide-search'),select=$('guide-example');
    function workedTable(spec,label){
      const wrapper=document.createElement('div'),table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),titles=document.createElement('tr');
      wrapper.className='guide-table-scroll';table.className='guide-worked-table';table.setAttribute('aria-label',label);
      for(const title of spec.columns){const cell=document.createElement('th');cell.scope='col';cell.textContent=title;titles.append(cell);}head.append(titles);
      for(const values of spec.rows){const row=document.createElement('tr');for(const value of values){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}body.append(row);}
      table.append(head,body);wrapper.append(table);return wrapper;
    }
    const flow=document.createElement('section');flow.id='guide-flow-section';flow.hidden=true;
    flow.innerHTML='<h3>这一篇的目标与数据流</h3><p id="guide-overview"></p><div id="guide-flow"></div>';
    $('guide-purpose').after(flow);
    $('guide-purpose').after($('guide-source-section'));
    const completeProgram=document.createElement('details'),completeTitle=document.createElement('summary'),shortProgram=document.createElement('pre'),shortCode=document.createElement('code');
    completeProgram.id='guide-complete-expression';completeTitle.textContent='展开完整可运行的 λ 表达式';shortCode.id='guide-expression-short';shortProgram.append(shortCode);
    const completePre=$('guide-expression').parentElement;completePre.before(shortProgram,completeProgram);completeProgram.append(completeTitle,completePre);
    $('guide-source-section').querySelector('h3').textContent='示例写法';
    $('guide-source-section').querySelector('p').textContent='讲解用函数名和数字简写，下方可查各函数定义；载入自由实验时使用完整可运行表达式。';
    const coreHeading=$('guide-core-section').querySelector('h3');coreHeading.textContent='本篇函数定义与辅助函数';
    const namingNote=document.createElement('p');namingNote.id='guide-naming-note';coreHeading.after(namingNote);
    const pairSection=document.createElement('section');pairSection.id='guide-pair-section';pairSection.hidden=true;
    pairSection.innerHTML='<h3>序对计算结果</h3><div id="guide-pair-expressions"></div>';
    $('guide-core-section').after(pairSection);
    const pairLink=document.createElement('a');pairLink.href='#guide-pair-section';pairLink.textContent='序对完整表达式';document.querySelector('.guide-toc').append(pairLink);
    const inputs=document.createElement('section');inputs.id='guide-input-section';
    inputs.innerHTML='<h3>输入参数：按什么顺序，传什么数据</h3><p>下表按完整表达式的参数顺序排列。数值相同但编码不同，仍是不同的 λ 数据。</p><div class="guide-table-scroll"><table id="guide-inputs"><thead><tr><th>参数</th><th>示例写法</th><th>编码</th><th>作用</th></tr></thead><tbody></tbody></table></div><p id="guide-parameter-note"></p><pre id="guide-call-box"><code id="guide-call"></code></pre>';
    $('guide-core-section').before(inputs);
    const inputLink=document.createElement('a');inputLink.href='#guide-input-section';inputLink.textContent='输入参数';
    document.querySelector('.guide-toc').children[0].after(inputLink);
    let selected=0,filtered=[];
    for(const name of new Set(P.examples.map(example=>example.category||'入门'))){
      const option=document.createElement('option');option.value=name;option.textContent=name;category.append(option);
    }
    function render(){
      const example=P.examples[selected],doc=lesson(example,api.precision());
      $('guide-title').textContent=doc.displayTitle??example.name;
      $('guide-purpose').textContent=doc.purpose||'从下面的关键表达式开始，跟随参数替换理解计算。';
      flow.hidden=!doc.flow;$('guide-overview').textContent=doc.overview??'';
      $('guide-flow').replaceChildren(...(doc.flow?[workedTable(doc.flow,'本篇从输入到结果的数据流')]:[]));
      $('guide-encoding').textContent=doc.encodingText??(example.encoding==='decimal'
        ?'小数表示使用正负标记、按书写顺序排列的丘奇数位列表、小数位数。例如0.125的数位表是[0,1,2,5]，位数是3。'
        :'数字按丘奇自然数表示；列表、有序对与布尔值也由 λ 函数编码。公式与过程使用辅助函数名作简写。');
      inputs.hidden=!doc.inputs?.length;
      inputLink.hidden=inputs.hidden;
      $('guide-inputs').querySelector('tbody').replaceChildren(...(doc.inputs??[]).map(input=>{
        const row=document.createElement('tr');for(const value of [input.name,input.value,input.encoding,input.role]){
          const cell=document.createElement('td');cell.textContent=value;row.append(cell);
        }return row;
      }));
      $('guide-parameter-note').textContent=doc.parameterNote??'讲解中的辅助函数名是完整表达式内部的局部绑定；不需要先把它们保存到函数库。';
      $('guide-call-box').hidden=!doc.compact;$('guide-call').textContent=doc.compact?'按下方局部定义书写的调用：\n'+doc.compact:'';
      $('guide-core').textContent=doc.core;
      pairSection.hidden=!doc.pairExamples?.length;pairLink.hidden=pairSection.hidden;
      $('guide-pair-expressions').replaceChildren(...(doc.pairExamples??[]).map(example=>{
        const block=document.createElement('div'),title=document.createElement('h4'),text=document.createElement('p'),pre=document.createElement('pre'),code=document.createElement('code'),result=document.createElement('p');
        const resultPre=document.createElement('pre'),resultCode=document.createElement('code');resultPre.className='guide-pair-result';resultCode.textContent=example.expected;resultPre.append(resultCode);
        const compactPre=document.createElement('pre'),compactCode=document.createElement('code'),complete=document.createElement('details'),summary=document.createElement('summary');
        compactCode.className='guide-pair-compact';compactCode.textContent=example.compactSource;compactPre.append(compactCode);complete.className='guide-pair-complete';summary.textContent='展开完整 λ 表达式与归约结果';complete.append(summary,pre,resultPre);
        block.className='guide-pair-expression';title.textContent=example.label;text.textContent=example.explanation;code.className='guide-pair-source';code.textContent=example.source;pre.append(code);result.textContent='归约结果：'+example.expectedLabel;
        block.append(title,result,compactPre,text,complete);return block;
      }));
      const paragraphs=values=>values.map(text=>{const p=document.createElement('p');p.textContent=text;return p;});
      $('guide-basics').replaceChildren(...paragraphs(doc.basics.filter(text=>example===P.examples[0]||!text.startsWith('λx.body')&&!text.startsWith('f a b 按')&&!text.startsWith('箭头 →'))));
      const coreLines=new Set(doc.core.split('\n'));
      $('guide-foundation').textContent=doc.foundation.split('\n').filter(line=>!coreLines.has(line)).join('\n');
      $('guide-naming-note').textContent=doc.namingNote??'';
      const symbolItem=symbol=>{
        const item=document.createElement('div'),details=document.createElement('details'),title=document.createElement('summary'),explanation=document.createElement('p'),pre=document.createElement('pre'),code=document.createElement('code');
        title.textContent=symbol.name+'：'+symbol.meaning.split('。')[0];explanation.textContent=symbol.meaning;code.textContent=`${symbol.name} = ${symbol.source}`;
        pre.append(code);details.append(title,explanation,pre);item.append(details);return item;
      };
      const uniqueSymbols=doc.symbols.filter(symbol=>!coreLines.has(symbol.name+' = '+symbol.source));
      const keyNames=doc.featured??uniqueSymbols.slice(-5).map(symbol=>symbol.name),keySymbols=uniqueSymbols.filter(symbol=>keyNames.includes(symbol.name)),others=uniqueSymbols.filter(symbol=>!keyNames.includes(symbol.name));
      $('guide-symbols').replaceChildren(...keySymbols.map(symbolItem));
      if(others.length){const details=document.createElement('details'),summary=document.createElement('summary');
        details.id='guide-all-symbols';summary.textContent=`其余 ${others.length} 个辅助函数：中文说明与完整 λ 定义`;
        details.append(summary,...others.map(symbolItem));$('guide-symbols').append(details);
      }
      $('guide-principle').replaceChildren(...paragraphs(doc.principle));
      $('guide-walkthrough').textContent=doc.walkthrough;
      $('guide-steps').replaceChildren(...doc.steps.map(([title,explanation,expression,calculation])=>{
        const item=document.createElement('li'),heading=document.createElement('h4'),text=document.createElement('p');
        heading.textContent=title;text.textContent=explanation;item.append(heading,text);
        if(expression){const pre=document.createElement('pre'),code=document.createElement('code');code.textContent=expression;pre.append(code);item.append(pre);}
        if(calculation)item.append(workedTable(calculation,title+'的计算表'));
        return item;
      }));
      $('guide-boundaries').replaceChildren(...paragraphs(doc.boundaries));$('guide-exercise').textContent=doc.exercise;
      const parameters=P.parametersFor(example,api.precision());
      $('guide-parameters').textContent=parameters.length?`完整表达式末尾的参数依次为${parameters.join('、')}。`:'函数的参数顺序见关键表达式，完整表达式包含示例的输入数据。';
      $('guide-expression').textContent=P.inputSourceFor(example,api.precision());
      shortCode.textContent=doc.compact??doc.walkthrough.split('\n')[0];completeProgram.open=false;
      const index=filtered.indexOf(selected);
      $('guide-previous').disabled=index<=0;$('guide-next').disabled=index>=filtered.length-1;
    }
    function filter(){
      const query=search.value.trim().toLowerCase();
      filtered=P.examples.flatMap((example,index)=>{
        const name=example.category||'入门';
        return (!category.value||category.value===name)&&`${name} ${example.name} ${titleFor(example)} ${example.description??''}`.toLowerCase().includes(query)?[index]:[];
      });
      if(!filtered.includes(selected))selected=filtered[0]??selected;
      const options=filtered.map(index=>{const option=document.createElement('option');option.value=index;option.textContent=titleFor(P.examples[index]);return option;});
      select.replaceChildren(...options);select.value=selected;
      $('guide-count').textContent=`找到 ${filtered.length} / ${P.examples.length} 个示例`;
      const empty=!filtered.length;
      $('guide-article').hidden=empty;$('guide-load').disabled=empty;select.disabled=empty;
      if(empty){$('guide-previous').disabled=true;$('guide-next').disabled=true;}else render();
    }
    select.addEventListener('change',()=>{selected=Number(select.value);render();api.save();});
    category.addEventListener('change',filter);search.addEventListener('input',filter);
    for(const [id,delta] of [['guide-previous',-1],['guide-next',1]])$(id).addEventListener('click',()=>{
      selected=filtered[filtered.indexOf(selected)+delta];select.value=selected;render();api.save();
    });
    $('guide-load').addEventListener('click',()=>api.load(P.examples[selected]));
    filter();
    return {refresh:render,capture:()=>P.examples[selected].name,restore:name=>{
      selected=Math.max(0,P.examples.findIndex(example=>example.name===name));category.value='';search.value='';filter();
    }};
  }
  const API={lesson,rawLesson,catalog,titleFor,init};root.LambdaGuide=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
