// 上传管理器 - 显示所有上传任务
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const newUploadBtn = document.getElementById('newUploadBtn');
const clearTasksBtn = document.getElementById('clearTasksBtn');

const serviceNames = {
  baidu: '百度网盘',
  quark: '夸克网盘',
  pan123: '123盘'
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadTasks();
  setupListeners();
});

window.addEventListener('beforeunload', () => {
  chrome.runtime.sendMessage({ action: 'clearAllTasks' }).catch(() => {});
});

newUploadBtn.addEventListener('click', async () => {
  // 打开新窗口显示popup
  await chrome.windows.create({
    url: 'popup/popup.html',
    type: 'popup',
    width: 420,
    height: 600
  });
});

clearTasksBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'clearAllTasks' });
  showEmptyState();
});

function setupListeners() {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'taskUpdated') {
      updateTaskUI(msg.task);
    }
  });
}

async function loadTasks() {
  const response = await chrome.runtime.sendMessage({ action: 'getAllTasks' });
  const tasks = response.tasks || [];
  
  if (tasks.length === 0) {
    showEmptyState();
  } else {
    tasks.forEach(task => renderTask(task));
  }
}

function showEmptyState() {
  taskList.innerHTML = '';
  emptyState.style.display = 'block';
}

function renderTask(task) {
  emptyState.style.display = 'none';
  
  let taskEl = document.getElementById(task.taskId);
  if (!taskEl) {
    taskEl = document.createElement('div');
    taskEl.id = task.taskId;
    taskEl.className = 'task-item';
    taskList.appendChild(taskEl);
  }

  taskEl.dataset.createdAt = String(task.createdAt || 0);
  
  const time = new Date(task.createdAt).toLocaleTimeString('zh-CN');
  
  taskEl.innerHTML = `
    <div class="task-header">
      <div class="task-name">${task.fileName}</div>
      <div class="task-time">${time}</div>
    </div>
    ${task.services.map(service => {
      const status = task.status[service] || { state: 'pending', progress: 0, reason: '' };
      const stateClass = status.state === 'completed' ? '' : status.state;
      const stateText = getStateText(status.state, status.progress, status.reason || '');
      
      return `
        <div class="service-progress">
          <div class="service-name">${serviceNames[service]}</div>
          <div class="progress-bar">
            <div class="progress-fill ${stateClass}" style="width: ${status.progress}%"></div>
          </div>
          <div class="service-status">${stateText}</div>
        </div>
      `;
    }).join('')}
  `;

  sortTasksByLatestFirst();
}

function updateTaskUI(task) {
  renderTask(task);
}

function getStateText(state, progress, reason) {
  if (state === 'pending') return '等待中';
  if (state === 'uploading') return `上传中 ${progress}%`;
  if (state === 'completed') return '✓ 完成';
  if (state === 'error') return `✗ 失败${reason ? `：${reason}` : ''}`;
  return '';
}

function sortTasksByLatestFirst() {
  const taskElements = Array.from(taskList.querySelectorAll('.task-item'));
  taskElements
    .sort((a, b) => Number(b.dataset.createdAt || 0) - Number(a.dataset.createdAt || 0))
    .forEach(el => taskList.appendChild(el));
}
