<div align="center">
  <img src="./build/icon.png" width="96" height="96" alt="ContextCue 应用图标" />
  <h1>ContextCue</h1>
  <p><strong>AI 建议始终跟着当前输入框。</strong></p>
  <p>一个本地优先的桌面写作助手，根据当前页面为聊天、表单、撰写、改写和搜索生成可直接使用的候选文本。</p>

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

只有用户主动唤起时，ContextCue 才会读取当前可见窗口的一张截图。在 macOS 上，它还会读取当前获得焦点的可编辑控件元数据，组合少量相关本地记忆，让视觉模型判断是回复、填表、撰写、改写、搜索还是通用补全，并在原输入框附近展示建议。

> [!IMPORTANT]
> ContextCue 必须使用支持**图片输入**的模型。部分纯文本模型会接受 OpenAI 兼容请求，却静默忽略其中的图片；ContextCue 会识别已知的纯文本模型，并阻止脱离上下文的回复生成。

## 功能概览

| | 能力 | 具体行为 |
|---|---|---|
| ⚡ | **任意输入框唤起** | 在聊天、表单、编辑器或搜索框按一次全局快捷键。 |
| ✦ | **流式 AI 问答** | 使用第二快捷键打开轻量问答框，或从候选建议继续追问。 |
| ✦ | **自动判断文本任务** | 在回复、填表、撰写、改写、搜索和通用补全间自动路由。 |
| ↔️ | **轻量候选浮窗** | 使用双指滑动、横向手势、圆点或方向键切换建议。 |
| ↵ | **精确写回但不提交** | macOS 会校验原输入控件后插入、替换选区或替换字段；失败时只复制。 |
| 🧠 | **显式本地记忆** | 使用资料、关系、偏好和已采用回复；不会自动写入模型建议。 |
| ◉ | **多个模型服务商** | 保存多个 Responses 或 Chat Completions 配置，并随时切换默认模型。 |
| 🔒 | **系统级密钥保护** | 使用 Electron `safeStorage` 和操作系统钥匙串分别加密 API Key。 |

窗口识别支持**微信**、**Slack**、**Lark / 飞书**、**Gmail**、**Microsoft Teams**、**WhatsApp** 及其他可见应用。

## 工作方式

```text
当前获得焦点的输入框
  └─ 全局快捷键
      └─ 读取输入控件元数据并截取可见窗口一次
          └─ 选择相关本地记忆
              └─ 判断文本任务并调用视觉模型
                  └─ 校验 1～5 条候选建议
                      └─ 滑动 · 复制 · 精确写回
```

浮窗会绑定生成时的应用、窗口，以及 macOS 上的原输入控件。页面或输入焦点变化后，候选会自动失效。

AI 问答默认使用 `⌘ ⇧ Enter` / `Ctrl ⇧ Enter`。当前页面上下文可以随时关闭，只保留在短生命周期浮窗会话中；回答会流式显示，关闭浮窗后截图和内存问答记录立即清除。

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

### 生成第一条建议

1. 打开 **Settings → Models**，填写服务商名称、API Base URL、模型 ID、API 格式和 API Key。
2. 确认 **Image input** 显示为支持，然后把该模型设为默认模型。
3. 按系统提示允许“屏幕录制”权限。macOS 的跨应用插入还需要“辅助功能/自动化”权限。
4. 打开任意应用或网页，并把光标放进需要写作的输入框。
5. macOS 按 `⌘ ⇧ Space`，Windows / Linux 按 `Ctrl ⇧ Space`。
6. 滑动选择候选建议并点击应用。ContextCue 只写入输入框，绝不会自动提交。

如需直接提问，按 `⌘ ⇧ Enter` / `Ctrl ⇧ Enter`，或点击候选浮窗里的 **Ask AI**。两个快捷键都可以在设置中修改；如果任意快捷键注册失败，ContextCue 会同时保留原来的两个快捷键。

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
| `acceptedReplies` | 为兼容旧数据保留的名称，记录最近 100 条已采用建议及其任务/目标元数据 |
| `settings` | 模型、候选数量、语言、快捷键和浮窗偏好 |

每次生成只会选择匹配的联系人、相关事实和最近采用的建议。模型建议的记忆始终需要用户确认。

## 隐私边界

- 只有用户从当前输入框主动唤起 ContextCue 后才会截图。
- 截图会发送给用户配置的模型服务商，但不会写入长期记忆文件。
- 截图和页面元数据中的文字都被视为不可信数据，而不是系统指令。
- 长期记忆保留在本机；每次只发送当前生成所需的小部分相关记忆。
- 保存后，API Key 不会再次暴露给渲染进程。
- 密码、验证码等敏感字段会在模型生成前被阻止。
- 应用建议前会先复制文本；如果原输入框发生变化，则不会向错误字段粘贴。
- ContextCue 不会在后台录屏，也不会自动提交表单或发送消息。

> [!NOTE]
> 以上是 ContextCue 自身的产品边界，不代表第三方模型服务商的数据政策。处理敏感会话前，请检查对应服务商的数据保留条款。

## 技术结构

```text
Electron 主进程
  ├─ desktopCapturer / screencapture：可见窗口截图
  ├─ globalShortcut：系统级快捷唤起
  ├─ safeStorage：逐模型加密 API Key
  ├─ Accessibility 输入目标适配：读取并校验焦点控件
  ├─ clipboard + 系统自动化：精确写回与安全回退
  ├─ MemoryStore：本地 JSON 记忆与配置迁移
  └─ Model adapter：Responses + Chat Completions

强类型 Preload Bridge
  └─ 最小化 IPC 接口

React 渲染进程
  ├─ 写作与截图工作区
  ├─ 可滑动候选建议
  ├─ 用户资料、关系和事实
  ├─ channel 与窗口发现
  ├─ 多模型设置
  └─ 与输入目标绑定的轻量浮窗
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

应用会在启动 15 秒后和运行期间每 6 小时检查一次更新。发现新版时通过系统通知和侧边栏提示，也可以打开 **Settings → App updates**，或右键点击托盘图标选择 **Check for Updates…**。

下载由用户点击开始，并显示进度。签名构建可点击 **Restart and update** 完成更新；目前默认的未签名 macOS 构建会在应用内下载并校验 DMG，点击 **Open installer** 后退出 ContextCue，把新应用拖入 Applications 并替换旧版。本地记忆和设置保存在应用包之外。

发布流程已支持可选签名、公证、双架构更新包和更新清单。启用签名所需的 GitHub 配置、发布步骤和验证方法见[更新发布指南](./docs/updates.md)。已有的无更新功能版本需要手动安装一次新版，之后才能在应用内获取更新。

## 当前限制

- 当前会缩放窗口截图，尚未提供用户自由框选区域。
- macOS 已能校验焦点输入控件并尝试精确写回；不支持 AX 写入的控件会回退到粘贴，Windows/Linux 仍为 best-effort。
- 浏览器暂未提供 DOM 扩展，复杂 iframe、Canvas 编辑器和部分富文本控件只能依赖系统辅助功能树与截图。
- channel 支持基于可见窗口，尚未同步历史 OAuth 消息。
- 局部截图、附近辅助功能文本、本地 OCR/脱敏、语音输入和日历操作仍在规划中。
- 记忆文件当前限制为仅本用户可读，但尚未整体加密；API Key 会单独加密。

ContextCue 仍是早期桌面 MVP，交互思路受到 OKEight 会话内回复流程的启发。生产化工作和后续功能见[产品路线](./TODO.md)。
