// Background Service Worker - 使用chrome.storage传递文件
const tasks = new Map();
let uploadManagerWindowId = null;
let openUploadManagerPromise = null;
const TASKS_STORAGE_KEY = 'uploadTasks';
const MAX_TASKS = 100;
const tasksReadyPromise = loadTasksFromStorage();

const SERVICE_CONFIG = {
  baidu: {
    name: '百度网盘',
    hosts: ['pan.baidu.com']
  },
  quark: {
    name: '夸克网盘',
    hosts: ['pan.quark.cn']
  },
  pan123: {
    name: '123盘',
    hosts: ['www.123pan.com', '123pan.com', 'yun.123pan.cn']
  }
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('多网盘上传助手已安装');
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === uploadManagerWindowId) {
    uploadManagerWindowId = null;
    clearAllTasks().catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'createUploadTask') {
    handleCreateTask(msg).then(sendResponse);
    return true;
  }
  
  if (msg.action === 'updateProgress') {
    handleUpdateProgress(msg);
    sendResponse({ success: true });
  }
  
  if (msg.action === 'getTaskStatus') {
    ensureTasksReady().then(() => {
      const task = tasks.get(msg.taskId);
      sendResponse({ task: task || null });
    });
    return true;
  }
  
  if (msg.action === 'getAllTasks') {
    ensureTasksReady().then(() => {
      sendResponse({ tasks: Array.from(tasks.values()) });
    });
    return true;
  }
  
  if (msg.action === 'getFileData') {
    getFileData(msg.fileId).then(fileData => {
      sendResponse({ fileData: fileData });
    });
    return true;
  }

  if (msg.action === 'clearAllTasks') {
    clearAllTasks().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function getFileData(fileId) {
  const metadata = await chrome.storage.local.get([fileId]);
  const meta = metadata[fileId];
  
  if (!meta) {
    throw new Error('文件元数据不存在');
  }
  
  return {
    name: meta.name,
    type: meta.type,
    size: meta.size,
    chunks: meta.chunks,
    fileId: fileId
  };
}

async function handleCreateTask(msg) {
  await ensureTasksReady();

  const taskId = `task_${Date.now()}`;
  
  const task = {
    taskId,
    fileId: msg.fileId,
    fileName: msg.fileName,
    fileSize: msg.fileSize,
    services: msg.services,
    status: {},
    createdAt: Date.now()
  };
  
  msg.services.forEach(service => {
    task.status[service] = { state: 'pending', progress: 0, reason: '' };
  });
  
  tasks.set(taskId, task);
  await persistTasks();
  await openUploadManager();
  startUpload(task);
  
  return { success: true, taskId };
}

async function openUploadManager() {
  if (openUploadManagerPromise) {
    return openUploadManagerPromise;
  }

  openUploadManagerPromise = doOpenUploadManager();

  try {
    await openUploadManagerPromise;
  } finally {
    openUploadManagerPromise = null;
  }
}

async function doOpenUploadManager() {
  const existingWindowId = await findUploadManagerWindowId();
  if (existingWindowId) {
    uploadManagerWindowId = existingWindowId;
    await chrome.windows.update(existingWindowId, { focused: true });
    return;
  }

  if (uploadManagerWindowId) {
    try {
      await chrome.windows.get(uploadManagerWindowId);
      await chrome.windows.update(uploadManagerWindowId, { focused: true });
      return;
    } catch (e) {
      uploadManagerWindowId = null;
    }
  }
  
  const window = await chrome.windows.create({
    url: 'upload-manager/manager.html',
    type: 'popup',
    width: 650,
    height: 550,
    focused: true
  });
  
  uploadManagerWindowId = window.id;
}

async function findUploadManagerWindowId() {
  const managerUrl = chrome.runtime.getURL('upload-manager/manager.html');
  const windows = await chrome.windows.getAll({ populate: true });

  for (const win of windows) {
    const tabs = win.tabs || [];
    for (const tab of tabs) {
      if (tab.url && tab.url.startsWith(managerUrl)) {
        return win.id;
      }
    }
  }

  return null;
}

async function startUpload(task) {
  const config = await chrome.storage.sync.get(['baiduUrl', 'quarkUrl', 'pan123Url']);
  
  for (const service of task.services) {
    const url = config[`${service}Url`];
    const urlCheck = validateServiceUrl(service, url);
    if (!urlCheck.valid) {
      updateTaskStatus(task.taskId, service, 'error', 0, urlCheck.reason);
      continue;
    }
    
    updateTaskStatus(task.taskId, service, 'uploading', 10, '');
    
    try {
      const normalWindowId = await getNormalWindowId();
      let tab;

      try {
        tab = await chrome.tabs.create({ windowId: normalWindowId, url: urlCheck.url, active: false });
      } catch (createError) {
        const fallbackWindowId = await getNormalWindowId(true);
        tab = await chrome.tabs.create({ windowId: fallbackWindowId, url: urlCheck.url, active: false });
      }
      
      await waitForTabLoad(tab.id, 20000);
      updateTaskStatus(task.taskId, service, 'uploading', 30, '');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await chrome.tabs.sendMessage(tab.id, {
        action: 'uploadFile',
        fileId: task.fileId,
        taskId: task.taskId,
        service: service
      });
      
    } catch (error) {
      console.error(`${service}上传失败:`, error);
      updateTaskStatus(task.taskId, service, 'error', 0, mapUploadErrorReason(error));
    }
  }
}

async function getNormalWindowId(forceRefresh = false) {
  const windows = await chrome.windows.getAll({ populate: true });
  const normalWindows = windows.filter(win => win.type === 'normal');

  if (normalWindows.length > 0) {
    const focusedWindow = normalWindows.find(win => win.focused);
    return (focusedWindow || normalWindows[0]).id;
  }

  if (forceRefresh) {
    const refreshedWindows = await chrome.windows.getAll({ populate: true });
    const refreshedNormalWindows = refreshedWindows.filter(win => win.type === 'normal');
    if (refreshedNormalWindows.length > 0) {
      const focusedRefreshedWindow = refreshedNormalWindows.find(win => win.focused);
      return (focusedRefreshedWindow || refreshedNormalWindows[0]).id;
    }
  }

  const createdWindow = await chrome.windows.create({ focused: false });
  return createdWindow.id;
}

function waitForTabLoad(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let finished = false;

    const timeoutId = setTimeout(() => {
      if (finished) return;
      finished = true;
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('页面加载超时'));
    }, timeoutMs);

    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function handleUpdateProgress(msg) {
  updateTaskStatus(msg.taskId, msg.service, msg.state, msg.progress, msg.reason || '');
}

function updateTaskStatus(taskId, service, state, progress, reason = '') {
  const task = tasks.get(taskId);
  if (!task) return;
  
  task.status[service] = { state, progress, reason };
  persistTasks().catch(() => {});
  
  chrome.runtime.sendMessage({
    action: 'taskUpdated',
    task: task
  }).catch(() => {});
}

async function loadTasksFromStorage() {
  try {
    const result = await chrome.storage.local.get([TASKS_STORAGE_KEY]);
    const storedTasks = result[TASKS_STORAGE_KEY] || [];

    storedTasks.forEach(task => {
      if (task && task.taskId) {
        tasks.set(task.taskId, task);
      }
    });
  } catch (error) {
    console.error('加载历史任务失败:', error);
  }
}

async function ensureTasksReady() {
  await tasksReadyPromise;
}

async function persistTasks() {
  try {
    const taskList = Array.from(tasks.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_TASKS);

    await chrome.storage.local.set({
      [TASKS_STORAGE_KEY]: taskList
    });
  } catch (error) {
    console.error('保存任务失败:', error);
  }
}

async function clearAllTasks() {
  tasks.clear();
  try {
    await chrome.storage.local.remove([TASKS_STORAGE_KEY]);
  } catch (error) {
    console.error('清空任务失败:', error);
  }
}

function validateServiceUrl(service, rawUrl) {
  const serviceConfig = SERVICE_CONFIG[service];
  if (!serviceConfig) {
    return { valid: false, reason: '网盘配置错误，请刷新后重试' };
  }

  if (!rawUrl) {
    return { valid: false, reason: '未配置目录链接' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (error) {
    return { valid: false, reason: '链接格式无效，请粘贴目录页URL' };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { valid: false, reason: '链接协议无效，必须为 http 或 https' };
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (!serviceConfig.hosts.includes(host)) {
    return { valid: false, reason: `链接域名不匹配，应为 ${serviceConfig.name}` };
  }

  return { valid: true, url: parsedUrl.toString() };
}

function mapUploadErrorReason(error) {
  const message = (error && error.message) ? error.message : '';

  if (message.includes('Could not establish connection')) {
    return '页面未注入上传脚本，请确认链接为网盘目录页';
  }

  if (message.includes('Receiving end does not exist')) {
    return '页面未就绪，请刷新网盘页面后重试';
  }

  if (message.includes('页面加载超时')) {
    return '页面加载超时，请重试';
  }

  if (message) {
    return message;
  }

  return '上传失败，请稍后重试';
}
