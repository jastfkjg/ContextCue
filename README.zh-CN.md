# Hiply

Hiply 是一个参考 [OKEight](https://hiply.pages.dev/) 实现的、本地优先的桌面回复助手。它会截取用户明确选择的对话窗口，将截图和相关的长期记忆一起发送给支持视觉理解的大模型，再返回多个可以直接发送的候选回答。用户可以左右滑动、使用方向键或点击按钮切换回答，并复制或插入选中的内容。

[English README](./README.md)

## 当前已实现

- 使用 Electron 获取当前可见的应用窗口和屏幕截图。
- 自动识别并优先展示微信、Slack、Lark/飞书、Gmail、Teams 和 WhatsApp。
- 支持 OpenAI Responses API 以及兼容的 Chat Completions 接口。
- 一次生成 2～5 条策略不同的结构化候选回复。
- 支持按钮、圆点、`←` / `→` 键和左右滑动切换候选回答。
- 支持复制回答，以及将回答尽力插入微信、Slack、Lark 等应用。
- 生成完成后显示置顶的紧凑候选回复悬浮窗。
- 使用 `CommandOrControl+Shift+Space` 从任意应用唤起 Hiply。
- 本地保存个人资料、表达规则、联系人关系卡、长期事实和跟进事项。
- 记录用户真正采用的回答，并在之后作为风格示例。
- 大模型建议的记忆必须由用户手动确认后才能保存，不会自动写入。
- 使用 Electron `safeStorage` 和系统钥匙串加密 API Key。

桌面客户端包含真实功能。浏览器模式只提供不联网的演示数据，用于检查界面；真实截图、全局快捷键、安全密钥存储和跨应用插入必须在 Electron 中运行。

## 工作流程

```text
全局快捷键唤起
  → 选择微信 / Slack / Lark / 其他可见窗口
  → 获取一张最新截图
  → 合并用户意图与相关本地记忆
  → 向视觉大模型发送一次请求
  → 校验并展示 2～5 条候选回复
  → 左右滑动、复制或插入其中一条
  → 只把用户真正采用的回答作为后续风格示例
```

## 快速开始

要求：

- Node.js 22.12+
- npm 10+
- macOS、Windows 或 Linux
- 支持图片输入的大模型 API Key

```bash
npm install
npm run dev
```

首次使用：

1. 打开 **Settings**。
2. 填写 API Base URL、模型、协议和 API Key。
3. macOS 用户需要允许“屏幕录制”权限，然后重启 Hiply。
4. 打开微信、Slack、Lark 或其他应用中的对话。
5. 按 `CommandOrControl+Shift+Space`，选择窗口，可以补充回复意图，然后点击 **Generate replies**。

默认使用 `https://api.openai.com/v1`、Responses API 和 `gpt-5.6-luna`。这些都可以在设置中修改。OpenAI 当前模型说明显示，最新模型系列可以通过 Responses API 接收图片输入：[OpenAI 模型文档](https://developers.openai.com/api/docs/models)。

也可以通过环境变量提供 API Key：

```bash
cp .env.example .env
export HIPLY_API_KEY="your-key"
export HIPLY_API_BASE_URL="https://api.openai.com/v1"
export HIPLY_MODEL="gpt-5.6-luna"
npm run dev
```

不要提交 `.env` 文件。

## 构建与测试

```bash
npm run dev          # Electron 开发模式
npm run lint         # TypeScript 类型检查
npm test             # 单元测试
npm run build        # 生产构建
npm run package      # 生成未打包的桌面应用目录
npm run dist         # 生成安装包
```

代码签名和 macOS 公证尚未配置。

## 长期记忆

Hiply 将长期记忆保存在 Electron 对应平台的 `userData/hiply-data.json` 中，包括：

- `profile`：用户身份、语言、表达风格和全局规则；
- `contacts`：联系人关系、渠道和专属沟通语气；
- `facts`：用户明确保存的长期事实、偏好和跟进事项；
- `acceptedReplies`：最近 100 条用户真正采用的回复；
- `settings`：模型与交互设置。

生成回答时，只选取匹配的联系人、相关事实，以及相同联系人/渠道下最近采用的回复，不会把整个记忆文件不加区分地发送给模型。

模型建议的记忆默认不会保存。用户需要在候选回复下面点击 `+` 才会写入本地文件。

## 隐私边界

- 只有用户选择窗口并点击 Generate 后才会截图。
- 截图会发送给用户配置的大模型服务商，但不会写入长期记忆文件。
- 截图中的所有文字都被视为不可信对话数据，系统提示会拒绝执行截图内的指令。
- 长期记忆保存在本机；每次只发送当前生成所需的小部分相关记忆。
- 保存后 API Key 不会再暴露给渲染进程。
- 插入失败时，回答仍保留在剪贴板中，可以手动粘贴。

以上是 Hiply 自身的产品边界，不代表第三方模型服务商的数据政策。处理敏感对话前，应检查所使用模型服务商的数据保留条款。

## 技术结构

```text
Electron 主进程
  ├─ desktopCapturer：窗口和屏幕截图
  ├─ globalShortcut：全局唤起
  ├─ safeStorage：API Key 加密
  ├─ clipboard / 系统脚本：复制与插入
  ├─ MemoryStore：本地长期记忆
  └─ Model adapter：Responses / Chat Completions

React 渲染进程
  ├─ 截图与意图工作区
  ├─ 候选回复滑动组件
  ├─ 用户资料、关系卡与事实管理
  ├─ 渠道和可见窗口列表
  ├─ 模型与快捷键设置
  └─ 置顶悬浮候选窗口
```

## 当前限制

- 当前将窗口截图缩放为 1440×900，尚未实现自由框选区域。
- 跨应用插入依赖操作系统自动化，失败时需要使用剪贴板手动粘贴。
- 微信、Slack 和 Lark 当前通过窗口截图支持，尚未接入历史消息 OAuth 同步。
- 本地语音输入、OCR 脱敏、日历操作、双击/长按 Option 等功能仍在规划中。
- 长期记忆文件目前使用仅当前用户可读的文件权限，但还没有整体加密；API Key 已单独加密。

后续计划和优化项见 [TODO.md](./TODO.md)。
