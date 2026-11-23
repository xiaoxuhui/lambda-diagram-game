const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/presets.js');
const index=prefix=>{const i=P.examples.findIndex(e=>e.name.startsWith(prefix));assert.ok(i>=0,prefix);return i;};
test('examples teach prerequisites before dependent programs',()=>{
  for(const chain of [
    ['恒等函数','TRUE','Church 数字','有序对','后继','加法','乘法','乘方','前驱','减法','比较','序对除法','整数除法'],
    ['组合子 B','组合子 C','组合子 W','S K K'],
    ['丘奇列表 · 空表','丘奇列表 · 头部插入','丘奇列表 · 首项','丘奇列表 · 折叠求和','丘奇列表 · 映射','丘奇列表 · 反转'],
    ['阶乘 · 迭代','阶乘 · Y','斐波那契','A000045','A000040'],
    ['自然数求和','排列数','组合数','多项式','生成导函数','生成原函数','定积分','λ解释器'],
    ['列表小数加法','列表小数除法','取负','幂函数','正弦','双曲正弦']
  ])for(let i=1;i<chain.length;i++)assert.ok(index(chain[i-1])<index(chain[i]),chain[i-1]+' before '+chain[i]);
  assert.equal(P.examples[index('后继')].category,'基础数学');
  assert.equal(index('整数除法'),index('序对除法')+1);
});
test('every example appears once and category groups stay together in both menus',()=>{
  assert.equal(new Set(P.examples.map(e=>e.name)).size,P.examples.length);
  const visited=new Set();let current;
  for(const example of P.examples){
    assert.ok(example.category,example.name);
    if(example.category!==current){assert.ok(!visited.has(example.category),example.category);visited.add(example.category);current=example.category;}
  }
  assert.equal(P.examples[0].name,'恒等函数 I');
  assert.equal(P.examples.length,77+require('../src/sequences.js').builtins.length+require('../src/boolean-circuits.js').examples.length+require('../src/list-operations.js').examples.length);
});
