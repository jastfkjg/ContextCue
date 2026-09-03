# 应用内更新与发布

ContextCue 使用 electron-updater 和公开的 GitHub Releases 更新源：`jastfkjg/ContextCue`。客户端不需要 GitHub token。开发模式、浏览器预览和非 AppImage 的 Linux 构建不检查更新。

## 用户体验

- 启动 15 秒后检查，运行期间每 6 小时检查；设置页和托盘菜单支持手动检查。
- 发现新版时显示系统通知和侧边栏入口，同一版本的同类通知每次运行最多显示一次。
- 用户点击下载后显示进度，可继续使用软件。后台检查不会自动下载或重启。
- 签名 macOS 构建、Windows NSIS、Linux AppImage 走 electron-updater 的更新安装流程。下载完成后由用户选择重启安装，不在普通退出时自动安装。
- 默认临时签名（ad-hoc）、未经 Apple 公证的 macOS 内测构建走 DMG 下载流程：使用更新清单中当前架构的文件，校验大小与 SHA-512，打开前再次校验。打开安装包后需退出应用，在 Applications 中替换。
- 网络或校验失败显示重试入口，失败的临时下载会删除，不执行未通过校验的安装包。
- 设置、模型密钥和记忆继续使用原来的 userData 位置，不随应用包替换而删除。

当前仓库的自动发布工作流只发布 macOS。Windows/Linux 已接入应用端更新逻辑，但需要另行发布对应安装包及 `latest.yml` / `latest-linux.yml`，才能实际检查更新。

## 内测发布：无需 Developer ID 证书

1. 合并改动，将 `package.json` 和 `package-lock.json` 版本更新为新的稳定版本，例如 `npm version 0.1.4 --no-git-tag-version`。
2. 提交代码，再推送与版本一致的 tag，例如 `v0.1.4`。版本号示例不代表已经发布。
3. `release-macos.yml` 分别构建 arm64 和 x64 的 DMG、ZIP、blockmap 与 `latest-mac.yml`，先完成整个应用及嵌套组件的 ad-hoc 签名，再验证更新源、更新模式及完整的资源签名。还会分别解压 ZIP、只读挂载 DMG，校验用户实际下载到的应用。
4. 发布任务验证文件大小和 SHA-512，合并两种架构的清单，生成 `SHA256SUMS`。所有资源先进入 draft Release，上传完成后才公开。

内测包使用 `mac.identity=-`，不能使用 `identity=null`：后者跳过应用签名，可能残留 Electron 可执行文件的 linker 签名，导致应用资源校验失败并显示“已损坏”。ad-hoc 签名保证资源完整性，但不能验证开发者身份，也不等于通过 Apple 公证或 Gatekeeper。

内测用户首次打开时如被拦截，可在确认来源可信后查看 **系统设置 → 隐私与安全性 → 仍要打开**。系统不一定提供这个选项；不能保证所有 macOS 版本都能放行。面向普通用户的发布应启用下面的 Developer ID 签名与公证流程，不应要求用户关闭系统安全检查。

更新包保留带版本和架构的文件名，例如 `ContextCue-0.1.4-arm64.zip`。网站使用的 `ContextCue-mac-arm64.dmg` 和 `ContextCue-mac-x64.dmg` 是额外副本，不会破坏更新清单引用。

第一份带更新功能的安装包仍需用户手动安装。该版本无法从已发布、没有更新清单的旧 Release 完成检查；发布下一份含完整清单的新版本后，整个在线链路才可用。

## 启用 macOS 重启安装

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中配置：

| 类型 | 名称 | 内容 |
|---|---|---|
| Variable | `MACOS_SIGNING_ENABLED` | `true` |
| Secret | `CSC_LINK` | 含私钥的 Developer ID Application `.p12` 证书，Base64 编码 |
| Secret | `CSC_KEY_PASSWORD` | `.p12` 导出密码 |
| Secret | `APPLE_ID` | Apple Developer 账号 |
| Secret | `APPLE_APP_SPECIFIC_PASSWORD` | 用于公证的 App 专用密码 |
| Secret | `APPLE_TEAM_ID` | Apple Developer Team ID |

需要 Apple Developer Program 的 **Developer ID Application** 证书；`Apple Development` 开发证书不能替代。启用后，CI 强制签名并公证，向打包后的 package.json 写入 `contextcueMacAutoUpdate: true`。CI 还会检查 Developer ID 身份、公证票据及 Gatekeeper 接受状态。缺少凭证会导致构建失败，不会悄悄退回未签名版本。不要在客户端、源码或更新清单中放入这些凭证。

未签名版本升级到首个签名版本仍通过应用内下载 DMG、手动替换完成。安装首个签名版本后，后续兼容签名版本即可重启安装。后续发布应保持签名身份兼容，不要再向同一稳定更新渠道发布未签名包。

本地内测打包使用 `npm run dist:mac:beta -- --arm64`（Intel 使用 `--x64`），显式启用 ad-hoc 签名并保持手动安装模式。通用的 `npm run dist` 不保证机器具备正确的签名配置。如需本地验证自动安装模式，须显式启用签名、公证和 `-c.extraMetadata.contextcueMacAutoUpdate=true`，并实际验证签名。标记本身不能代替签名。

## 验证

- `npm run build`：类型检查及生产构建。
- `npm test`：包含更新状态机、并发点击、重试、损坏安装包与双架构发布清单测试。
- 本地打包：`npm run dist:mac:beta -- --arm64`。
- 检查下载包：`BUILD_ARCH=arm64 SIGNING_ENABLED=false node scripts/verify-macos-artifacts.mjs`。正式签名版使用 `SIGNING_ENABLED=true`，Intel 使用 `BUILD_ARCH=x64`。
- 检查打包配置：`BUILD_ARCH=arm64 SIGNING_ENABLED=false node scripts/verify-macos-update-config.mjs`。
- 不要在 DMG/ZIP 生成后补签再沿用旧清单：签名必须在生成安装包与更新校验值之前完成。修复后用新版本号发布，不覆盖旧版本资产。
- 发布前用两个不同版本的实际安装包做升级测试：验证发现新版、下载、稍后安装、退出重启、用户数据保留。分别覆盖 arm64 与 Intel，并在签名版本上验证原生安装。单元测试和本地打包不能代替这一步。

上游参考：[electron-builder 自动更新](https://www.electron.build/docs/features/auto-update/)、[Electron macOS 签名要求](https://www.electronjs.org/docs/latest/api/auto-updater/)。
