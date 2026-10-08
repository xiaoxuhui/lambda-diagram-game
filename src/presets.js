(function(root) {
  'use strict';
  const I='λx.x', TRUE='λx.λy.x', FALSE='λx.λy.y';
  const TWO='λf.λx.f (f x)', THREE='λf.λx.f (f (f x))', FIVE='λf.λx.f (f (f (f (f x))))';
  const ADD='λm.λn.λf.λx.m f (n f x)', SUCC='λn.λf.λx.f (n f x)';
  const examples = [
    { name:'恒等函数 I', term:I },
    { name:'TRUE · 选择第一个', term:TRUE },
    { name:'FALSE / 数字 0', term:FALSE },
    { name:'Church 数字 2', term:TWO },
    { name:'S K K → I', term:`(λx y z.(x z) (y z)) (${TRUE}) (${TRUE})` },
    { name:'加法 · 2 + 3', term:`(${ADD}) (${TWO}) (${THREE})` },
    { name:'Ω · 无限循环', term:'(λx.x x) (λx.x x)' },
    { name:'防止变量捕获', term:'(λx.λy.x) y' }
  ];
  const levels = [
    { id:1, name:'原样返回', topic:'恒等函数', description:'让恒等函数接收一个函数，看看它如何把输入原样返回。', start:'(λx.x) (λy.y)', target:I, targetLabel:'I · 恒等函数', hint:'λx.x 会把参数直接返回。点击「单步」，观察 x 被整个参数替换。' },
    { id:2, name:'选择第一个', topic:'布尔值', description:'两个函数交给 TRUE；归约后应只留下第一个。', start:`(${TRUE}) (${I}) (${TRUE})`, target:I, targetLabel:'I · 恒等函数', hint:'λx.λy.x 接收两个参数，只保留第一个。第二个参数可以是任意式。' },
    { id:3, name:'翻转真假', topic:'函数组合', description:'将 TRUE 交给 NOT，把选择第一个变成选择第二个。', start:`(λb.b (${FALSE}) (${TRUE})) (${TRUE})`, target:FALSE, targetLabel:'FALSE · 选择第二个', hint:'布尔值本身是一个选择器。NOT 把 FALSE 放在第一位，把 TRUE 放在第二位。' },
    { id:4, name:'再走一步', topic:'Church 数', description:'将 2 交给后继函数，让 f 在 x 上连续作用 3 次。', start:`(${SUCC}) (${TWO})`, target:THREE, targetLabel:'Church 数字 3', hint:'数字 n 表示重复 n 次。「加一」会在 n 次作用之外，再套上一层 f。' },
    { id:5, name:'让函数相加', topic:'Church 加法', description:'不用数字运算，只靠函数，把 2 + 3 归约成 5。', start:`(${ADD}) (${TWO}) (${THREE})`, target:FIVE, targetLabel:'Church 数字 5', hint:'m f (n f x)：先把 f 作用 n 次，再继续作用 m 次。运行到正规形后验证答案。' }
  ];
  const API={ examples, levels, I, TRUE, FALSE };
  root.LambdaPresets=API;
  if(typeof module !== 'undefined' && module.exports) module.exports=API;
})(typeof globalThis !== 'undefined' ? globalThis : window);
