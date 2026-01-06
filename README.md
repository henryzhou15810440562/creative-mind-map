# 创意思维导图 - Creative Mind Map

一个基于 AI 的创意发散思维工具，帮助你探索无限创意可能。

## ✨ 特性

- 🤖 **AI 驱动**: 使用 Claude AI 智能生成关联概念
- 🎨 **可视化**: 基于 React Flow 的交互式思维导图
- 💾 **自动保存**: 本地存储，刷新不丢失
- 📝 **历史记录**: 追踪你的思维探索过程
- 🎯 **智能总结**: AI 自动生成知识框架和学习路径

## 🚀 快速开始

### 环境要求

- Node.js 20+
- npm/yarn/pnpm

### 安装依赖

```bash
npm install
```

### 配置环境变量

创建 `.env.local` 文件：

```env
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_BASE_URL=https://api.anthropic.com  # 可选
```

### 运行开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 📖 使用说明

1. **添加节点**: 在底部输入框输入概念，按回车或点击"发散"
2. **展开节点**: 双击节点，AI 会生成相关子概念
3. **编辑节点**: 单击节点进行编辑或删除
4. **选择节点**: 右键或 Shift+点击选择多个节点
5. **删除连线**: 点击连线可删除
6. **生成总结**: 点击左上角"生成总结"按钮

## 🛠️ 技术栈

- **框架**: Next.js 16 (App Router)
- **UI**: React 19 + TailwindCSS 4
- **可视化**: React Flow 11
- **动画**: Framer Motion 12
- **AI**: Anthropic Claude API
- **语言**: TypeScript 5

## 📦 构建部署

```bash
npm run build
npm start
```

### Vercel 部署

1. 推送代码到 GitHub
2. 在 Vercel 导入项目
3. 配置环境变量 `ANTHROPIC_API_KEY`
4. 自动部署完成

## 🔧 项目结构

```
src/
├── app/
│   ├── api/generate/      # AI 生成 API
│   ├── layout.tsx         # 根布局
│   ├── page.tsx           # 主页
│   └── globals.css        # 全局样式
├── components/
│   ├── MindMap.tsx        # 思维导图容器
│   ├── MindMapContent.tsx # 核心逻辑
│   ├── WordNode.tsx       # 节点组件
│   ├── InputBox.tsx       # 输入框
│   └── HistoryPanel.tsx   # 历史面板
```

## 📝 更新日志

### v0.2.0 (2026-01-06)
- ✅ 添加 localStorage 持久化
- ✅ 改进错误处理和用户反馈
- ✅ 提取常量配置
- ✅ 优化代码结构
- ✅ 添加 API 重试机制
- ✅ 增强类型安全

### v0.1.0
- 初始版本发布

## 📄 License

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
