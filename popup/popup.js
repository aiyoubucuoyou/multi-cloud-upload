let selectedFile = null;

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

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  setupEventListeners();
});

function setupEventListeners() {
  const fileSelectArea = document.getElementById('fileSelectArea');
  const fileInput = document.getElementById('fileInput');
  
  fileSelectArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);
  document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
  document.getElementById('uploadBtn').addEventListener('click', startUpload);

  ['baidu', 'quark', 'pan123'].forEach(service => {
    const input = document.getElementById(`${service}Url`);
    if (!input) return;
    input.addEventListener('input', () => renderUrlValidationHint(service));
    input.addEventListener('blur', () => renderUrlValidationHint(service));
  });
}

function handleFileSelect(e) {
  selectedFile = e.target.files[0];
  if (selectedFile) {
    document.getElementById('fileName').textContent = `${selectedFile.name} (${formatSize(selectedFile.size)})`;
    document.getElementById('uploadBtn').disabled = false;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function loadConfig() {
  const config = await chrome.storage.sync.get(['baiduUrl', 'quarkUrl', 'pan123Url']);
  document.getElementById('baiduUrl').value = config.baiduUrl || '';
  document.getElementById('quarkUrl').value = config.quarkUrl || '';
  document.getElementById('pan123Url').value = config.pan123Url || '';

  ['baidu', 'quark', 'pan123'].forEach(service => renderUrlValidationHint(service));
}

async function saveConfig() {
  const config = {
    baiduUrl: document.getElementById('baiduUrl').value.trim(),
    quarkUrl: document.getElementById('quarkUrl').value.trim(),
    pan123Url: document.getElementById('pan123Url').value.trim()
  };

  const saveValidationError = validateConfigForSave(config);
  if (saveValidationError) {
    alert(saveValidationError);
    return;
  }
  
  await chrome.storage.sync.set(config);
  
  const btn = document.getElementById('saveConfigBtn');
  btn.textContent = '✓ 已保存';
  setTimeout(() => btn.textContent = '保存配置', 2000);
}

async function startUpload() {
  if (!selectedFile) {
    alert('请先选择文件');
    return;
  }
  
  document.getElementById('uploadBtn').disabled = true;
  document.getElementById('uploadBtn').textContent = '处理中...';
  
  const selectedServices = ['quark', 'pan123', 'baidu'].filter(
    service => document.getElementById(service).checked
  );
  
  if (selectedServices.length === 0) {
    alert('请至少选择一个网盘');
    document.getElementById('uploadBtn').disabled = false;
    document.getElementById('uploadBtn').textContent = '开始上传';
    return;
  }

  const currentConfig = {
    baiduUrl: document.getElementById('baiduUrl').value.trim(),
    quarkUrl: document.getElementById('quarkUrl').value.trim(),
    pan123Url: document.getElementById('pan123Url').value.trim()
  };

  const uploadValidationError = validateServiceUrls(selectedServices, currentConfig);
  if (uploadValidationError) {
    alert(uploadValidationError);
    document.getElementById('uploadBtn').disabled = false;
    document.getElementById('uploadBtn').textContent = '开始上传';
    return;
  }

  await chrome.storage.sync.set(currentConfig);
  
  try {
    const fileId = `file_${Date.now()}`;
    
    // 分片存储文件
    await storeFileInChunks(fileId, selectedFile);
    
    await chrome.runtime.sendMessage({
      action: 'createUploadTask',
      fileId: fileId,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      fileType: selectedFile.type || getMimeType(selectedFile.name),
      services: selectedServices
    });
    
    document.getElementById('uploadBtn').textContent = '✓ 已提交';
    setTimeout(() => {
      document.getElementById('uploadBtn').textContent = '开始上传';
      document.getElementById('uploadBtn').disabled = false;
      document.getElementById('fileName').textContent = '点击选择要上传的文件';
      document.getElementById('fileInput').value = '';
      selectedFile = null;
    }, 1500);
    
  } catch (error) {
    console.error('上传失败:', error);
    alert('上传失败: ' + error.message);
    document.getElementById('uploadBtn').disabled = false;
    document.getElementById('uploadBtn').textContent = '开始上传';
  }
}

async function storeFileInChunks(fileId, file) {
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk
  const chunks = Math.ceil(file.size / CHUNK_SIZE);
  
  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const base64 = await blobToBase64(chunk);
    
    await chrome.storage.local.set({
      [`${fileId}_chunk_${i}`]: base64
    });
  }
  
  // 存储元数据
  await chrome.storage.local.set({
    [fileId]: {
      name: file.name,
      type: file.type || getMimeType(file.name),
      size: file.size,
      chunks: chunks
    }
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getMimeType(fileName) {
  // 支持所有文件格式，返回通用二进制类型
  return 'application/octet-stream';
}

function validateConfigForSave(config) {
  for (const service of ['baidu', 'quark', 'pan123']) {
    const url = config[`${service}Url`];
    if (!url) continue;

    const serviceError = validateSingleServiceUrl(service, url);
    if (serviceError) {
      return serviceError;
    }
  }

  return '';
}

function validateServiceUrls(selectedServices, config) {
  for (const service of selectedServices) {
    const url = config[`${service}Url`];
    const serviceError = validateSingleServiceUrl(service, url, true);
    if (serviceError) {
      return serviceError;
    }
  }

  return '';
}

function validateSingleServiceUrl(service, rawUrl, required = false) {
  const serviceConfig = SERVICE_CONFIG[service];
  if (!serviceConfig) return '网盘配置错误，请刷新后重试';

  if (!rawUrl) {
    if (required) {
      return `${serviceConfig.name}未配置目录链接，请先粘贴目录页URL`;
    }
    return '';
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (error) {
    return `${serviceConfig.name}链接格式无效，请粘贴完整目录页URL`;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return `${serviceConfig.name}链接必须是 http 或 https`;
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (!serviceConfig.hosts.includes(host)) {
    return `${serviceConfig.name}链接域名不匹配，请粘贴该网盘目录页URL`;
  }

  return '';
}

function renderUrlValidationHint(service) {
  const input = document.getElementById(`${service}Url`);
  const hint = document.getElementById(`${service}UrlHint`);
  if (!input || !hint) return;

  const rawUrl = input.value.trim();
  hint.className = 'url-hint';
  input.classList.remove('url-valid', 'url-invalid');

  if (!rawUrl) {
    hint.textContent = '';
    return;
  }

  const error = validateSingleServiceUrl(service, rawUrl, false);
  if (error) {
    hint.textContent = error;
    hint.classList.add('error');
    input.classList.add('url-invalid');
    return;
  }

  hint.textContent = '目录链接可用';
  hint.classList.add('success');
  input.classList.add('url-valid');
}
