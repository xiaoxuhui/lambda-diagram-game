const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),P=require('../src/presets.js'),Guard=require('../src/run-guard.js'),Lazy=require('../src/lazy-eval.js');
const fibonacci=C.parse(P.examples.find(e=>e.name.startsWith('斐波那契')).term);

test('growth observation uses elapsed time and net growth, not an expression-size quota',()=>{
  let time=0,duration=1000;const guard=Guard.create({windowMs:()=>duration,now:()=>time,initial:100});
  assert.equal(guard.check(1000000),false);
  time=1000;assert.equal(guard.check(1000000),true);
  time=2000;assert.equal(guard.check(999999),false);
  duration=0;time=3000;assert.equal(guard.check(10000000),false);
  duration=3000;time=4000;assert.equal(guard.check(20000000),false);
  guard.reset(1);time=7000;assert.equal(guard.check(2),true);
});

test('waiting checkpoints trigger even when the computation size is flat or shrinking',()=>{
  let time=0,duration=1000;
  const guard=Guard.create({windowMs:()=>duration,now:()=>time,initial:100,requireGrowth:false});
  time=999;assert.equal(guard.check(100),false);
  time=1000;assert.equal(guard.check(100),true);
  time=2000;assert.equal(guard.check(50),true);
  guard.reset(50);time=2500;assert.equal(guard.check(50),false);
  time=3000;assert.equal(guard.check(50),true);
  duration=0;time=10000;assert.equal(guard.check(50),false);
});

test('a timed-out finite evaluation can continue to its correct result without restarting',async()=>{
  let duration=0.01,resume,reached,reason;
  const paused=new Promise(resolve=>{reached=resolve;});
  const calculation=Lazy.normalize(C.parse('4096'),{growthWindowMs:0,waitWindowMs:()=>duration,signal:AbortSignal.timeout(5000),onPause:progress=>{
    reason=progress.reason;assert.match(progress.message,/等待时长/);reached();return new Promise(resolve=>{resume=resolve;});
  }});
  await paused;assert.equal(reason,'wait');
  duration=0;resume(true);
  assert.equal(C.churchNumber(await calculation),4096);
});

test('waiting checkpoint errors are distinct from a proven cycle',async()=>{
  await assert.rejects(Lazy.normalize(C.parse('4096'),{growthWindowMs:0,waitWindowMs:0.01}),error=>error.name==='WaitPauseError'&&/尚未确认/.test(error.message));
});

test('unapplied Fibonacci evades exact-cycle detection but now pauses without requiring a repeating state',async()=>{
  let term=fibonacci.fn;const cycles=C.cycleCheck(term);
  for(let i=0;i<150;i++){const step=C.step(term);assert.ok(step);term=step.term;assert.equal(cycles(term,step),false);}
  assert.ok(C.inspect(term).nodes>C.inspect(fibonacci.fn).nodes);
  await assert.rejects(Lazy.normalize(fibonacci.fn,{signal:AbortSignal.timeout(5000)}),error=>error.name==='GrowthPauseError'&&/尚未确认/.test(error.message));
  const result=await Lazy.normalize(fibonacci,{signal:AbortSignal.timeout(5000)});
  assert.equal(C.churchNumber(result),5);
});

test('paused normalization makes no progress until continued, then resumes its retained computation',async()=>{
  const controller=new AbortController();let resolvePause,resume,pauses=0;
  const paused=new Promise(resolve=>{resolvePause=resolve;}),steps=[];
  const calculation=Lazy.normalize(fibonacci.fn,{signal:controller.signal,growthWindowMs:20,onPause:progress=>{
    pauses++;steps.push(progress.steps);
    if(pauses===1){resolvePause();return new Promise(resolve=>{resume=resolve;});}
    controller.abort();return false;
  }});
  const cancellation=assert.rejects(calculation,/取消/);
  await paused;const frozen=steps[0];await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(pauses,1);assert.equal(steps[0],frozen);
  resume(true);await cancellation;assert.ok(steps[1]>steps[0]);
});

test('cancelling while paused settles immediately without waiting for a continue action',async()=>{
  const controller=new AbortController();let paused;
  const reachedPause=new Promise(resolve=>{paused=resolve;});
  const calculation=Lazy.normalize(fibonacci.fn,{signal:controller.signal,growthWindowMs:20,onPause:()=>{paused();return new Promise(()=>{});}});
  const cancellation=assert.rejects(calculation,/取消/);
  await reachedPause;controller.abort();await cancellation;
});
