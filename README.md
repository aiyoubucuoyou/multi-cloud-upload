# 🚀 多网盘上传助手 (Multi-Cloud Upload Helper)

Chrome 浏览器扩展，一键上传文件到百度网盘、夸克网盘、123盘的指定目录。

## ✨ 功能特点

- 📤 **批量上传** — 同时上传文件到多个网盘
- 🎯 **指定目录** — 配置网盘目标目录 URL，文件直接上传到指定位置
- ☁️ **多平台支持** — 百度网盘、夸克网盘、123盘
- 🔒 **本地处理** — 所有操作在浏览器内完成，不经过第三方服务器
- 💾 **配置持久化** — 网盘目录配置自动保存，无需重复设置

## 📦 安装方法

1. 下载或克隆本项目
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的 **「开发者模式」**
4. 点击 **「加载已解压的扩展程序」**
5. 选择项目根目录即可

## 🚀 使用方法

### 第一步：配置网盘目录

1. 在浏览器中打开对应网盘
2. 导航到目标上传目录
3. 复制浏览器地址栏的完整 URL
4. 粘贴到插件对应输入框中
5. 点击「保存配置」

**示例 URL：**
| 网盘 | 示例 |
|------|------|
| 百度网盘 | `https://pan.baidu.com/disk/main#/index?path=%2F2026` |
| 夸克网盘 | `https://pan.quark.cn/list#/list/all/xxx` |
| 123盘 | `https://www.123pan.com/?homeFilePath=xxx` |

### 第二步：上传文件

1. 点击浏览器工具栏的插件图标
2. 选择要上传的文件（支持多选）
3. 勾选要上传的目标网盘
4. 点击「开始上传」
5. 插件自动打开网盘页面并执行上传

## 📁 项目结构

```
multi-cloud-upload/
├── manifest.json           # Chrome 扩展配置
├── popup/                  # 弹出窗口界面
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/             # 后台服务
│   └── background.js
├── content/                # 网盘页面注入脚本
│   ├── baidu-content.js    # 百度网盘
│   ├── quark-content.js    # 夸克网盘
│   └── 123pan-content.js   # 123盘
├── upload-manager/         # 上传管理页面
│   ├── manager.html
│   ├── manager.css
│   └── manager.js
├── utils/                  # 工具模块
│   └── file-storage.js
├── icons/                  # 扩展图标
├── LICENSE                 # MIT 许可证
└── README.md               # 项目说明
```

## ⚠️ 技术说明

由于浏览器安全限制，Chrome 扩展无法直接操作网页的文件上传控件。本插件采用**模拟拖拽**方式上传：

- ✅ 支持拖拽上传的网盘可正常工作
- ⚠️ 部分网盘可能禁用了拖拽上传

### 上传失败时

1. 按 `F12` 打开开发者工具 → Console 查看日志
2. 手动将文件拖拽到网盘页面中
3. 反馈问题，持续优化中

## 🛠️ 技术栈

- **Chrome Extension Manifest V3**
- **JavaScript (ES6+)**
- **Chrome APIs** — storage、cookies、tabs、scripting

## 📄 许可证

[MIT License](LICENSE) — 自由使用、修改和分发。

---

<div align="center">
  如果觉得有用，请给个 ⭐ Star 支持一下！
</div>
