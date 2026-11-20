(function(root){
  'use strict';
  const C=root.LambdaCore||require('./core.js');
  const F=root.LambdaFunctionReduction||require('./function-reduction.js');
  const RECENT_FRAMES=4;
  const orders=new Map([
    ['normal:right',['normal','right']],
    ['applicative:left',['applicative','left']],
    ['applicative:right',['applicative','right']]
  ]);
  function step(term,choice,reducer){
    if(choice&&Array.isArray(choice.unfold))return reducer?.unfoldAt(term,choice.unfold)??null;
    if(Array.isArray(choice))return C.stepAt(term,choice);
    return choice==null?C.step(term):C.step(term,...orders.get(choice));
  }
  function create(original=null,functionDefinitions=[]){
    const reducer=F.create(functionDefinitions);
    const initial=original?{term:original,change:null}:null,choices=[];
    let recent=initial?[initial]:[],steps=0;
    const length=()=>initial?steps+1:0;
    function keep(frames,frame){
      frames.push(frame);
      if(frames.length>RECENT_FRAMES)frames.shift();
    }
    function peek(index){return index===0?initial:recent[index-(length()-recent.length)];}
    function append(result,choice){
      const previous=choices.at(-1)?.[1]??null;
      const same=choice===previous||(Array.isArray(choice)&&Array.isArray(previous)&&choice.length===previous.length&&choice.every((part,i)=>part===previous[i]));
      if(!same)choices.push([steps,choice]);
      steps++;
      keep(recent,{term:result.term,change:result});
    }
    async function replay(index,{signal,keepRecent=false}={}){
      let frame=initial,started=performance.now(),choice=null,next=0;
      const frames=[];
      if(keepRecent)frames.push(initial);
      for(let i=0;i<index;i++){
        if(signal?.aborted)throw signal.reason;
        if(choices[next]?.[0]===i)choice=choices[next++][1];
        const change=step(frame.term,choice,reducer);
        if(!change)throw new C.LambdaError('无法重算此步归约。');
        frame={term:change.term,change};
        if(keepRecent)keep(frames,frame);
        if(performance.now()-started>=8){
          await new Promise(resolve=>setTimeout(resolve,0));
          started=performance.now();
        }
      }
      if(signal?.aborted)throw signal.reason;
      return keepRecent?frames:frame;
    }
    function rewind(frames){
      steps--;
      if(choices.at(-1)?.[0]===steps)choices.pop();
      recent.pop();
      if(frames)recent=frames;
      return peek(length()-1);
    }
    return {get length(){return length();},get choices(){return choices;},peek,append,replay,rewind};
  }
  const API={create,step,isOrder:order=>orders.has(order)};
  root.LambdaTrace=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
