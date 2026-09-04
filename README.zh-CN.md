<div align="center">
  <img src="./build/icon.png" width="80" height="80" alt="ContextCue 应用图标" />
  <h1>ContextCue</h1>
  <p><strong>不离开当前窗口，就能提问、写作和回复。</strong></p>
  <p>一个看得懂屏幕上下文的桌面 AI 助手，帮你理清信息，也帮你把话说得更合适。</p>
  <p>
    <a href="https://github.com/jastfkjg/ContextCue/releases">下载 macOS 版</a>
    · <a href="#快速开始">快速开始</a>
    · <a href="./README.md">English</a>
  </p>
  <p><strong>一个快捷键唤起</strong> · 自选模型服务商 · 由你决定是否发送</p>
</div>

![ContextCue 根据中文团队对话，在真实浮窗中提供三条中文回复候选。](./docs/images/readme/reply-zh-CN.png)

面对一条待回复的消息、一段没写完的文字，或一个需要理解的页面，按下快捷键，ContextCue 就会根据当前窗口给出写作建议，或回答你的问题。挑选、调整，再使用，让思路留在正在做的事情上。

*演示图由真实的 ContextCue 浮窗与虚构聊天场景组成，回复为预设示例，不含私人对话，也未调用真实模型。中文示例中的对话、提问和回复均为中文；产品按钮保留当前的英文界面。[图片制作说明](./scripts/readme/README.md)。*

## 它能帮你做什么

| 当你想要…… | ContextCue 可以…… |
|---|---|
| **回复一段对话** | 根据可见内容生成最多五条候选，用方向键、圆点或横向滑动切换。 |
| **找到合适的语气** | 把建议改得更简短、更亲切或更直接，并与原始候选对照。 |
| **快速理解页面** | 在轻量问答框里总结信息、解释内容、梳理下一步，可选择是否使用页面上下文。 |
| **处理聊天之外的写作** | 起草文案、改写段落、填写字段，或组织搜索词。 |
| **使用自己的模型** | 通过 Responses 或 Chat Completions 接口连接支持图片输入的模型，并保存多个配置。 |
| **掌握使用过程** | 检查后再复制或插入，在本地查看服务商返回的 Token 用量，不自动发送或提交。 |

可从应用或浏览器窗口唤起，无需为每个应用单独接入。macOS 识别到输入框时可直接插入，不支持插入时仍可复制。搜索辅助只生成搜索词，不执行联网搜索。

## 快速开始

### 1. 安装或从源码运行

**macOS：** 打开 [Releases 下载页](https://github.com/jastfkjg/ContextCue/releases)，选择适合 **Apple Silicon（`arm64`）** 或 **Intel（`x64`）** 的 DMG，将 ContextCue 拖入 Applications。签名状态及首次启动方式请查看对应版本说明；早期体验版可能尚未经过 Apple 公证。

**源码运行：** 需要 **Node.js 22.12+** 和 **npm 10+**。

```bash
git clone https://github.com/jastfkjg/ContextCue.git
cd ContextCue
npm install
npm run dev
```

macOS 是目前主要验证的平台。Windows 和 Linux 可从源码运行；Linux 截图需要 X11 与 `xdotool`。跨应用插入目前仅支持 macOS。

### 2. 配置模型

首次打开的 **Setup guide（设置引导）** 会带你添加模型和 API Key、验证图片输入、检查屏幕权限，再用虚构对话体验一次建议生成。macOS 的辅助功能权限为可选，用于向支持的输入框插入文字。

写作建议和带页面上下文的问答需要支持**图片输入**的模型；关闭页面上下文后，**Ask AI** 也可使用纯文本模型。模型请求（包括首次验证）可能产生服务商费用。[模型与环境变量配置 →](./docs/guide.zh-CN.md#模型服务商)

### 3. 打开窗口，按下快捷键

| 操作 | macOS | Windows / Linux |
|---|---|---|
| 生成写作建议 | `⌘ ⇧ Space` | `Ctrl ⇧ Space` |
| 打开 AI 问答 | `⌘ ⇧ Enter` | `Ctrl ⇧ Enter` |
| 切换候选 | `←` / `→` | `←` / `→` |
| 使用当前候选¹ | `Enter` | `Enter` |
| 提交修改要求 | `⌘ Enter` | `Ctrl Enter` |
| 收起输入区或关闭浮窗 | `Esc` | `Esc` |

¹ 在文本输入框之外、且修改输入区收起时生效。macOS 识别到输入框时插入，否则复制，不会发送消息。两个全局快捷键均可在 **Settings（设置）** 中修改。

## 看看实际使用方式

### 把建议改成你的语气

点击 **Revise（修改）**，直接描述想怎么改，新候选会在同一个浮窗中出现。可以使用 **Shorter（更简短）**、**Warmer（更亲切）**、**More direct（更直接）**，也可以写自己的要求，随时返回原始候选对比。

![ContextCue 真实修改输入区展示中文草稿，以及“简短、亲切一点，保留开会时间”的中文修改要求。](./docs/images/readme/revise-zh-CN.png)

### 直接问当前页面，省去搬运上下文

打开 **Ask AI（AI 问答）**，问一句“评审前我还需要做什么？”或“帮我解释这个页面”。回答会逐步显示，也支持继续追问。点击顶部页面标签，即可选择下一次提问是否使用已截取的页面。

![ContextCue 用中文回答评审前需要做什么，并指出待办事项是提前发送更新后的演示文稿。](./docs/images/readme/ask-zh-CN.png)

每次唤起都会开启新会话；会话中的截图保持不变，页面变化后请重新唤起。关闭页面上下文后，下一次请求不再附带截图和页面元数据，但本会话中已有的回答仍可能提供上下文。

## 上下文由你决定

- **主动唤起才截取页面。** 不在后台录屏，每次重新唤起会获取新的页面快照。
- **使用你选择的服务商。** 请求需要截图和相关文字时，它们会发送到你配置的模型接口。“本地优先”指数据存储方式，模型推理可能在远端进行。
- **配置与记录保存在本机。** 设置、记忆文档和用量记录留在本地；当前页面的建议与问答不读取长期记忆或历史采用回复。API Key 使用操作系统能力加密，整个数据文件尚未加密。
- **文字经你确认再使用。** 复制或插入都需要明确操作，ContextCue 不自动提交表单或发送消息。截图不会自动脱敏。

[完整隐私说明](./docs/guide.zh-CN.md#隐私边界) · [平台与截图限制](./docs/guide.zh-CN.md#当前限制)

## 开发与文档

基于 **Electron、React 和 TypeScript** 构建。浏览器预览使用演示数据；真实截图、全局快捷键、安全密钥存储和跨应用插入需要在 Electron 中运行。

```bash
npm run lint     # TypeScript 检查
npm test         # 单元测试
npm run build    # 构建桌面应用
npm run package  # 生成未打包的应用目录
```

| 继续了解 | 内容 |
|---|---|
| [使用指南](./docs/guide.zh-CN.md) | 首次设置、模型接入、本地记忆、用量统计、技术结构及完整开发命令 |
| [交互流程](./docs/interaction-flows.md) | 会话边界、候选修改与验收步骤（英文） |
| [更新与发布](./docs/updates.md) | 打包、签名和应用内更新 |
| [截图源文件](./scripts/readme/README.md) | 重新生成中英文演示图 |
| [产品路线](./TODO.md) | 当前重点与计划中的功能 |

ContextCue 仍是早期桌面 MVP。可以先从一段你愿意分享给模型服务商的对话或页面试起。遇到问题或有改进建议，欢迎[提交 Issue](https://github.com/jastfkjg/ContextCue/issues)。
