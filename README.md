# Dual AI Chat (Dual-Model-Parallel)

双重 AI 对话助手 - 在同一个窗口中并排对比不同的 AI 模型。

![App Screenshot](src/assets/screenshot.png) <!-- Note: User can replace this with a real screenshot later -->

## 项目功能

- **双窗口对比**：左、右面板独立选择 AI 提供商（DeepSeek, ChatGPT, 豆包, Kimi, MiniMax）。
- **一键发送**：在底部统一输入框输入内容，同时发送给两个 AI。
- **自动隐藏侧边栏**：内置智能脚本，在加载模型时自动收起各大平台的侧边栏，最大限度利用屏幕空间。
- **开启新对话**：一键重置两侧的对话状态。
- **自定义布局**：支持通过拖拽调整左右分栏比例及输入框高度。
- **本地存储**：自动记住您最后一次选择的 AI 提供商。

## 快速开始

### 环境依赖

- [Node.js](https://nodejs.org/) (建议版本 18.x 或更高)
- npm

### 安装与运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/guoleopard/Dual-Model-Parallel.git
   cd Dual-Model-Parallel
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动应用**
   ```bash
   npm start
   ```

## 打包发布

项目支持使用 `electron-builder` 或 `electron-packager` 进行打包。

### 使用 electron-packager (推荐在 Windows 下使用)
```bash
npx electron-packager . DualAIChat --platform=win32 --arch=x64 --out=release-builds --overwrite
```

### 使用 electron-builder
```bash
npm run dist
```

## 技术栈

- **Electron**: 跨平台桌面应用框架
- **HTML/CSS/JS**: 原生 Web 技术开发
- **Webview**: 安全隔离的网页嵌入技术

## 许可

[MIT](LICENSE)
