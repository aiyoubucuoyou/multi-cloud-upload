// 123盘 - 直接读取分片
(function() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'uploadFile') {
      performUpload(request.fileId, request.taskId, request.service);
      sendResponse({ success: true });
    }
  });
  
  async function performUpload(fileId, taskId, service) {
    console.log('123盘：开始上传', fileId);
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getFileData',
        fileId: fileId
      });
      
      if (!response.fileData) {
        throw new Error('文件数据不存在');
      }
      
      const meta = response.fileData;
      console.log('123盘：开始读取分片', meta.chunks, '个');
      
      chrome.runtime.sendMessage({
        action: 'updateProgress',
        taskId: taskId,
        service: service,
        state: 'uploading',
        progress: 40
      });
      
      const chunks = [];
      for (let i = 0; i < meta.chunks; i++) {
        const result = await chrome.storage.local.get([`${meta.fileId}_chunk_${i}`]);
        const base64 = result[`${meta.fileId}_chunk_${i}`];
        const blob = await fetch(base64).then(r => r.blob());
        chunks.push(blob);
      }
      
      console.log('123盘：分片读取完成，开始合并');
      const file = new File(chunks, meta.name, { type: meta.type });
      
      chrome.runtime.sendMessage({
        action: 'updateProgress',
        taskId: taskId,
        service: service,
        state: 'uploading',
        progress: 60
      });
      
      const fileInput = document.querySelector('input[type="file"]');
      
      if (fileInput) {
        console.log('123盘：找到file input，设置文件');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          taskId: taskId,
          service: service,
          state: 'completed',
          progress: 100
        });
        console.log('123盘：上传完成');
      } else {
        console.error('123盘：未找到file input');
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          taskId: taskId,
          service: service,
          state: 'error',
          progress: 0
        });
      }
    } catch (error) {
      console.error('123盘上传失败:', error);
      chrome.runtime.sendMessage({
        action: 'updateProgress',
        taskId: taskId,
        service: service,
        state: 'error',
        progress: 0
      });
    }
  }
  
  console.log('123盘上传脚本已加载');
})();
