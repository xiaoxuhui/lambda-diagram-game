(function(root){
  'use strict';
  function save(name,content,mime) {
    if(typeof root.LambdaAndroid?.saveFile==='function') {
      root.LambdaAndroid.saveFile(name,content,mime);return;
    }
    const url=URL.createObjectURL(new Blob([content],{type:`${mime};charset=utf-8`}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  root.LambdaDownload={save};
})(typeof globalThis!=='undefined'?globalThis:window);
