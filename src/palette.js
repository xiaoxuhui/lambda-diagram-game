(function(root){
  'use strict';
  const defaults=Object.freeze({
    binders:Object.freeze(['#64d8bd','#eabe75','#9fa6ff','#f38fac','#79bcf2','#c2dd87']),
    highlight:'#ff91b7',application:'#d5dff1',free:'#aeb9ce'
  });
  const hexColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
  function validate(palette){
    if(!palette||!Array.isArray(palette.binders)||palette.binders.length!==defaults.binders.length)return null;
    const {binders,highlight,application,free}=palette;
    if(![...binders,highlight,application,free].every(hexColor))return null;
    return {binders:binders.map(color=>color.toLowerCase()),highlight:highlight.toLowerCase(),application:application.toLowerCase(),free:free.toLowerCase()};
  }
  const channels={
    RGB:[['R',255],['G',255],['B',255]],
    HSV:[['H (°)',360],['S (%)',100],['V (%)',100]],
    CMYK:[['C (%)',100],['M (%)',100],['Y (%)',100],['K (%)',100]]
  };
  function toHex(mode,values){
    let rgb=values;
    if(mode==='HSV'){
      const [h,s,v]=values,k=n=>(n+h/60)%6;
      rgb=[5,3,1].map(n=>255*v/100*(1-s/100*Math.max(0,Math.min(k(n),4-k(n),1))));
    }else if(mode==='CMYK'){
      rgb=values.slice(0,3).map(channel=>255*(1-channel/100)*(1-values[3]/100));
    }
    return '#'+rgb.map(channel=>Math.round(channel).toString(16).padStart(2,'0')).join('');
  }
  function fromHex(mode,color){
    const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16));
    if(mode==='RGB')return rgb;
    const [r,g,b]=rgb.map(channel=>channel/255),max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
    if(mode==='CMYK')return max?[r,g,b].map(channel=>100*(1-channel/max)).concat(100*(1-max)):[0,0,0,100];
    const hue=!delta?0:max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4;
    return [(60*hue+360)%360,max?100*delta/max:0,100*max];
  }
  function init(panel,onChange){
    const select=panel.querySelector('#palette-target'),mode=panel.querySelector('#palette-mode');
    const picker=panel.querySelector('#palette-picker'),fields=panel.querySelector('#palette-channels');
    let palette=defaults,inputs=[];
    const selected=()=>palette.binders[select.value]??palette[select.value];
    function sync(){
      const color=selected(),values=fromHex(mode.value,color);
      picker.value=color;
      inputs.forEach((input,i)=>{input.value=Number(values[i].toFixed(2));});
    }
    function buildFields(){
      inputs=channels[mode.value].map(([name,max])=>{
        const label=document.createElement('label'),input=document.createElement('input');
        input.type='number';input.min='0';input.max=max;input.step=mode.value==='RGB'?'1':'any';input.required=true;
        label.append(name,input);fields.append(label);
        return input;
      });
      sync();
    }
    function update(color){
      if(color===selected())return;
      const target=select.value;
      if(target in palette.binders){
        const binders=palette.binders.slice();binders[target]=color;
        palette={...palette,binders};
      }else palette={...palette,[target]:color};
      onChange(palette);
    }
    fields.addEventListener('input',()=>{
      if(inputs.some(input=>!input.validity.valid))return;
      picker.value=toHex(mode.value,inputs.map(input=>input.valueAsNumber));
      update(picker.value);
    });
    picker.addEventListener('input',()=>{update(picker.value);sync();});
    select.addEventListener('change',sync);
    mode.addEventListener('change',()=>{fields.replaceChildren();buildFields();});
    panel.querySelector('#palette-reset').addEventListener('click',()=>{palette=defaults;sync();onChange(palette);});
    buildFields();
    return {restore(saved=defaults){palette=saved;sync();}};
  }
  const API={defaults,validate,init};
  root.LambdaPalette=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:window);
