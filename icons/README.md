# 图标文件说明

Chrome插件需要以下尺寸的图标：

- icon16.png (16x16像素)
- icon48.png (48x48像素)  
- icon128.png (128x128像素)

## 创建图标

你可以使用以下工具创建图标：

1. **在线工具**：
   - https://www.favicon-generator.org/
   - https://www.canva.com/

2. **设计软件**：
   - Photoshop
   - Figma
   - GIMP (免费)

3. **临时方案**：
   在开发阶段，可以使用任意图片转换为对应尺寸的PNG文件

## 图标设计建议

- 使用简洁的云朵或上传箭头图标
- 背景透明
- 颜色鲜明易识别
- 在小尺寸下也清晰可见

## 快速生成

如果暂时没有图标，可以先创建纯色方块占位：

```bash
# 使用ImageMagick生成占位图标（如果已安装）
convert -size 16x16 xc:#1976d2 icon16.png
convert -size 48x48 xc:#1976d2 icon48.png
convert -size 128x128 xc:#1976d2 icon128.png
```

或者从网上下载免费的云盘图标。
