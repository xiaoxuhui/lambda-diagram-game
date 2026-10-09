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
  function saveBackup(name,content) {
    if(typeof root.LambdaAndroid?.saveFile==='function') {
      if(typeof root.LambdaAndroid.saveFileConfirmed!=='function')throw new Error('当前安卓版无法确认备份保存结果，请更新安卓版后再清空。');
      if(root.LambdaAndroid.saveFileConfirmed(name,content,'application/json')!==true)throw new Error('存档保存失败，当前内容未清空。');
      return 'saved';
    }
    save(name,content,'application/json');return 'requested';
  }
  root.LambdaDownload={save,saveBackup};
})(typeof globalThis!=='undefined'?globalThis:window);
