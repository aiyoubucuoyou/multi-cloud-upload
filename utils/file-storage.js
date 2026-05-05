// IndexedDB文件存储模块
const DB_NAME = 'UploadFilesDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function saveFile(file) {
  const db = await openDB();
  const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({
      id: id,
      name: file.name,
      type: file.type || getMimeType(file.name),
      size: file.size,
      blob: file,
      timestamp: Date.now()
    });
    
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

async function getFile(fileId) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(fileId);
    
    request.onsuccess = () => {
      const record = request.result;
      if (record) {
        resolve(new File([record.blob], record.name, { type: record.type }));
      } else {
        reject(new Error('File not found'));
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteFile(fileId) {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(fileId);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getMimeType(fileName) {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0];
  const mimeTypes = {
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.exe': 'application/x-msdownload',
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
