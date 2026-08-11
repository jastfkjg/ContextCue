<div align="center">
  <img src="./build/icon.png" width="96" height="96" alt="ContextCue 应用图标" />
  <h1>ContextCue</h1>
  <p><strong>回复始终跟着当前对话。</strong></p>
  <p>一个本地优先的桌面回复助手，把眼前的聊天内容变成几条自然、可直接使用的候选回复。</p>

  <p>
    <img alt="Electron" src="https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white" />
    <img alt="React" src="https://img.shields.io/badge/React-18-20232A?logo=react&logoColor=61DAFB" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
    <img alt="本地优先" src="https://img.shields.io/badge/本地优先-默认开启-C8FF3D?labelColor=24251F&color=C8FF3D" />
  </p>

  <p>
    <a href="./README.md">English</a>
    · <a href="#快速开始">快速开始</a>
    · <a href="#隐私边界">隐私边界</a>
    · <a href="./TODO.md">产品路线</a>
  </p>
</div>

---

只有用户主动唤起时，ContextCue 才会读取当前会话的一张截图。它会组合少量相关的本地记忆，调用用户配置的视觉模型生成多条不同策略的回复，并在聊天输入区附近以轻量浮窗展示。

> [!IMPORTANT]
> ContextCue 必须使用支持**图片输入**的模型。部分纯文本模型会接受 OpenAI 兼容请求，却静默忽略其中的图片；ContextCue 会识别已知的纯文本模型，并阻止脱离上下文的回复生成。

## 功能概览

| | 能力 | 具体行为 |
|---|---|---|
| ⚡ | **快捷回复** | 在当前聊天窗口按一次全局快捷键，无需跳转到主窗口。 |
| 💬 | **理解当前上下文** | 一次生成 2～5 条结构经过校验、策略明显不同的候选回复。 |
| ↔️ | **轻量候选浮窗** | 使用双指滑动、横向手势、圆点或方向键切换回复。 |
| ↵ | **插入但不发送** | 把选中的回复写入原聊天输入框，留给用户确认。 |
| 🧠 | **显式本地记忆** | 使用资料、关系、偏好和已采用回复；不会自动写入模型建议。 |
| ◉ | **多个模型服务商** | 保存多个 Responses 或 Chat Completions 配置，并随时切换默认模型。 |
| 🔒 | **系统级密钥保护** | 使用 Electron `safeStorage` 和操作系统钥匙串分别加密 API Key。 |

窗口识别支持**微信**、**Slack**、**Lark / 飞书**、**Gmail**、**Microsoft Teams**、**WhatsApp** 及其他可见应用。

## 工作方式

```text
当前聊天窗口
  └─ 全局快捷键
      └─ 截取该窗口一次
          └─ 选择相关本地记忆
              └─ 调用已配置的视觉模型
                  └─ 校验 2～5 条候选回复
                      └─ 滑动 · 复制 · 插入
```

浮窗会绑定生成时的应用和窗口。切换到其他 channel 或浏览器标签页后自动隐藏；回到原会话时自动恢复。

## 快速开始

### 运行要求

- Node.js 22.12+
- npm 10+
- macOS、Windows 或 Linux
- 支持图片输入的模型 API Key

### 本地运行

```bash
git clone https://github.com/jastfkjg/ContextCue.git
cd ContextCue
npm install
npm run dev
```

### 生成第一条回复

1. 打开 **Settings → Models**，填写服务商名称、API Base URL、模型 ID、API 格式和 API Key。
2. 确认 **Image input** 显示为支持，然后把该模型设为默认模型。
3. 按系统提示允许“屏幕录制”权限。macOS 的跨应用插入还需要“辅助功能/自动化”权限。
4. 打开需要回复的会话，并让聊天输入区保持可见。
5. macOS 按 `⌘ ⇧ Space`，Windows / Linux 按 `Ctrl ⇧ Space`。
6. 滑动选择候选回复并点击插入图标。ContextCue 只填写输入框，绝不会自动发送。

快捷键可以在设置中修改。如果新快捷键已被其他应用占用，ContextCue 会继续保留原快捷键。

### 环境变量

也可以用环境变量提供默认模型连接：

```bash
cp .env.example .env
export CONTEXTCUE_API_KEY="your-key"
export CONTEXTCUE_API_BASE_URL="https://api.openai.com/v1"
export CONTEXTCUE_MODEL="your-vision-model"
npm run dev
```

不要提交 `.env` 文件。

## 模型服务商

每个模型配置都拥有独立的接口地址、协议、图片输入能力和加密 API Key。

| API 格式 | 适用情况 |
|---|---|
| **Responses API** | 服务商明确支持 OpenAI 风格的 `/responses` 接口。 |
| **Chat Completions** | 服务商提供兼容的 `/chat/completions` 接口，包括许多云端及本地服务。 |

连接测试用于验证接口连通性和密钥。图片能力会单独记录，因为部分兼容服务会接受多模态格式，却在不报错的情况下丢弃图片。已有的 DeepSeek 纯文本模型会在配置迁移时标记为 text-only；未知模型可以在设置中手动修正。

## 本地记忆

ContextCue 将数据保存在 Electron 对应平台的 `userData/contextcue-data.json`：

| 数据 | 用途 |
|---|---|
| `profile` | 稳定的个人背景、语言、写作风格和全局规则 |
| `contacts` | 联系人关系、渠道、备注和专属沟通语气 |
| `facts` | 用户明确保存的偏好、长期事实和跟进事项 |
| `acceptedReplies` | 最近 100 条用户真正选择的回复 |
| `settings` | 模型、候选数量、语言、快捷键和浮窗偏好 |

每次生成只会选择匹配的联系人、相关事实，以及同一联系人或渠道下最近采用的回复。模型建议的记忆始终需要用户确认。

## 隐私边界

- 只有用户从当前会话主动唤起 ContextCue 后才会截图。
- 截图会发送给用户配置的模型服务商，但不会写入长期记忆文件。
- 截图内的文字被视为不可信对话数据，而不是系统指令。
- 长期记忆保留在本机；每次只发送当前生成所需的小部分相关记忆。
- 保存后，API Key 不会再次暴露给渲染进程。
- 插入操作会先复制回复；系统自动化失败时仍可手动粘贴。
- ContextCue 不会在后台录屏，也不会自动发送消息。

> [!NOTE]
> 以上是 ContextCue 自身的产品边界，不代表第三方模型服务商的数据政策。处理敏感会话前，请检查对应服务商的数据保留条款。

## 技术结构

```text
Electron 主进程
  ├─ desktopCapturer / screencapture：可见窗口截图
  ├─ globalShortcut：系统级快捷唤起
  ├─ safeStorage：逐模型加密 API Key
  ├─ clipboard + 系统自动化：复制与尽力插入
  ├─ MemoryStore：本地 JSON 记忆与配置迁移
  └─ Model adapter：Responses + Chat Completions

强类型 Preload Bridge
  └─ 最小化 IPC 接口

React 渲染进程
  ├─ 回复与截图工作区
  ├─ 可滑动候选回复
  ├─ 用户资料、关系和事实
  ├─ channel 与窗口发现
  ├─ 多模型设置
  └─ 与会话绑定的轻量浮窗
```

浏览器构建使用不联网的预览数据，仅供检查界面。真实截图、全局快捷键、安全密钥存储和跨应用插入必须在 Electron 中运行。

## 开发命令

| 命令 | 用途 |
|---|---|
| `npm run dev` | 启动 Electron 开发模式 |
| `npm run lint` | 执行 TypeScript 检查 |
| `npm test` | 运行单元测试 |
| `npm run test:watch` | 以监听模式运行测试 |
| `npm run build` | 构建主进程、Preload 和 Renderer |
| `npm run package` | 生成未打包的桌面应用目录 |
| `npm run dist` | 生成平台安装包 |

代码签名和 macOS 公证尚未配置。

## 当前限制

- 当前会缩放窗口截图，尚未提供用户自由框选区域。
- 跨应用插入仍依赖操作系统自动化，属于 best-effort 行为。
- channel 支持基于可见窗口，尚未同步历史 OAuth 消息。
- 本地 OCR/脱敏、语音输入、日历操作和原生应用辅助功能适配仍在规划中。
- 记忆文件当前限制为仅本用户可读，但尚未整体加密；API Key 会单独加密。

ContextCue 仍是早期桌面 MVP，交互思路受到 OKEight 会话内回复流程的启发。生产化工作和后续功能见[产品路线](./TODO.md)。
