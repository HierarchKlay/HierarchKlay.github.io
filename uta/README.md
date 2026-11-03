# 日々うた · 播放验证

访问地址：https://hierarchklay.github.io/uta/

从原来的私有 Sites 验证页同步到 GitHub Pages。访问本站无需 ChatGPT 或 GitHub 登录；Apple Music 完整歌曲播放仍由 Apple 的会员和授权决定。

## 维护与发布

- 此目录就是可直接部署的静态源代码：`index.html`、`styles.css`、`app.js`，无需安装依赖或构建。
- 修改本目录并提交到 `main`，由仓库现有 Pages 发布流程部署。保留仓库其他目录与发布配置。
- 版本 06：增加网站共享开发者令牌配置，所有设备自动读取；继续使用 `/uta/` 相对路径部署。后续修改需要同步更新资源版本号。
- 不复制 Sites 的 `.openai/hosting.json`、部署凭据、用户记录或登录信息。

## 当前功能

- Rain（秦 基博）、なんもねえ（忘れらんねえよ）、猫じゃらし（7co）三个官方音源入口，可选 MusicKit v3 或原有官方嵌入播放器。
- MusicKit：网站共享令牌自动读取、本机令牌文件导入／粘贴备用、Apple Music 用户授权、播放／暂停、真实播放时间、进度条与指定秒数跳转。
- A/B 选段循环为前台测试功能，进入后台后关闭；不能保证音频采样级精度或锁屏循环。
- 两种播放器不会同时播放，测试报告按播放器区分；保留此前的嵌入播放记录。
- 默认中国大陆曲库，可切换地区或填写官方歌曲分享链接。
- 播放器外的官网与歌曲直接链接、Safari 手动复制备用方式。
- 播放、锁屏及锁屏控制结果由用户手动记录，仅保存在当前浏览器，可复制汇总。

## 实机验证（2026-11-01）

来源：用户手动观察，非自动播放检测。设备：iPhone / iOS 27.0.1，使用中国大陆 Apple Music 会员。

歌曲：[猫じゃらし — 7co](https://music.apple.com/cn/album/6781555396)。

| 验证项目 | 用户报告结果 |
| --- | --- |
| 完整歌曲播放 | 已听完整首 |
| 锁屏续播 | 持续播放至少 1 分钟 |
| 锁屏控制 | 都可使用 |

本次结果仅确认上述歌曲和设备环境。Rain、なんもねえ、长时间锁屏及跨歌曲连续播放尚未验证。不能据此推断网站已经能够读取播放进度、跳转到指定句或执行自动循环。

## MusicKit 接入与实机验证

版本 05 读取 MusicKit v3 的 `currentPlaybackTime`、`currentPlaybackDuration` 和播放事件，通过 `seekToTime()` 跳转。页面轮询只读取 SDK 的实际位置，不推进独立时钟。曲目通过官方 `setQueue()` 加载，普通播放保留整首能力。

### 一次配置，多端使用

1. 在 Mac 打开 [共享配置编辑页](https://github.com/HierarchKlay/HierarchKlay.github.io/edit/main/uta/musickit-config.json)。
2. 把已生成的开发者令牌完整粘贴到 `developerToken` 的双引号内，保持 JSON 格式，提交到 `main`。初始配置为空，须完成这一步才会生效。
3. 等 Pages 发布完成，Mac 和 iPhone 刷新本站，会自动读取同一枚令牌。Apple Music 会员授权仍需每台设备／浏览器分别完成，由 MusicKit 管理，不能把 Music User Token 跨设备共享。

开发者令牌是随网页下发的公开配置，访问者可见。仅在此文件放置为本站生成的开发者令牌，保留 Origin 限制和有限有效期；**不要放入 `.p8` 私钥或 Music User Token**。到期前在同一文件更新，设备刷新后获取新值。当前没有服务端自动签发／续期。

网站每次进入 MusicKit 模式时优先检查共享配置；成功连接后不再使用旧的本地开发者令牌。配置读取使用 `cache: no-store`，最多等待 8 秒；不可用或过期时可退回有效的本机令牌，并显示来源。Pages/CDN 发布仍可能需要时间。手动导入仅影响当前浏览器，不会自动写入 GitHub。共享模式下“重置本机授权”只重置当前设备，再次载入仍使用网站配置。

本机导入备用：在 Mac 的文件选择窗口按 Command + Shift + G，输入 `~/Library/Application Support/Hibi Uta/`，选择生成的令牌 `.txt`。本地校验格式、到期时间及 Origin，不等同于 Apple 的签名验证或会员验证。

先用猫じゃらし验证授权、超过 30 秒播放、进度随播放变化且暂停时停止、前后跳转、前台 A/B 循环，再关闭循环测试锁屏与锁屏控件。之前的嵌入播放通过不代表 MusicKit 已通过。

### 已完成的软件检查

- Node 测试：签名工具、token／URL／进度／循环、共享配置优先级／轮换／错误回退，共 12 项通过。执行 `node --test uta/tools/*.test.mjs`。
- 浏览器界面：误粘私钥会本地拒绝并清空输入；播放器切换与记录隔离正常；390px 手机宽度布局已检查。
- 使用无权限模拟令牌和模拟 SDK 测试连接、授权后的 UI、播放、暂停、30 秒跳转、A/B 回跳及切歌重置。模拟页面仅用于本地 QA，不发布。
- 版本 06 另用隔离的模拟共享配置验证自动连接、重置本机授权后自动重连和 390px 手机布局；默认空配置下手动入口可用。
- 尚未使用真实开发者令牌或会员账户测试 MusicKit 播放；iPhone Safari、锁屏续播与锁屏控制等待用户实测。

官方参考：[MusicKit v3 实例接口](https://js-cdn.music.apple.com/musickit/v3/docs/iframe.html?path=/story/reference-javascript-musickit-instance--page)、[队列接口](https://js-cdn.music.apple.com/musickit/v3/docs/iframe.html?path=/story/reference-javascript-queue--page)、[官方嵌入播放器](https://artists.apple.com/support/1117-apple-music-marketing-tools)。

## MusicKit 令牌准备

本地签名工具与 Mac 操作步骤见 [tools/README.md](tools/README.md)。脚本使用 Node.js 自带加密模块，生成有效期 30 天、带本站 Origin 的开发者令牌。私钥始终保存在本机，生成的开发者令牌可由站点所有者填入公开共享配置。工具已经使用模拟密钥验证签名、错误输入处理、输出权限和不覆盖行为；真实 Apple 账户授权与播放控制仍待用户实测。

## 功能边界

这是播放控制验证阶段。逐句歌词同步、假名开关与伴奏尚未接入。A/B 循环仅前台测试。页面加载成功不等于歌曲播放或会员登录成功。

原始 iPhone 目标为 iOS 27.0.1。GitHub Pages 解决本站登录门槛，不保证修复 Apple 弹窗、会员授权或锁屏播放问题。

Apple 官方说明：https://artists.apple.com/support/1117-apple-music-marketing-tools
