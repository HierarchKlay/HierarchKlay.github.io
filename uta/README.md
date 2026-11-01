# 日々うた · 播放验证

访问地址：https://hierarchklay.github.io/uta/

从原来的私有 Sites 验证页同步到 GitHub Pages。访问本站无需 ChatGPT 或 GitHub 登录；Apple Music 完整歌曲播放仍由 Apple 的会员和授权决定。

## 维护与发布

- 此目录就是可直接部署的静态源代码：`index.html`、`styles.css`、`app.js`，无需安装依赖或构建。
- 修改本目录并提交到 `main`，由仓库现有 Pages 发布流程部署。保留仓库其他目录与发布配置。
- 版本 04：迁移到 `/uta/`，资源使用相对路径，分享链接按当前部署地址生成。后续修改需要同步更新 HTML 资源版本号。
- 不复制 Sites 的 `.openai/hosting.json`、部署凭据、用户记录或登录信息。

## 当前功能

- Rain（秦 基博）、なんもねえ（忘れらんねえよ）、猫じゃらし（7co）三个 Apple Music 官方嵌入播放器入口。
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

## 下一步：播放器控制能力

逐句高亮需要真实播放进度；点击歌词和单句／选段循环需要跳转播放位置。当前官方嵌入播放器尚未接入这些控制能力，也未找到其面向外部网页的已公开控制接口。不得用独立计时器模拟真实播放进度。

Apple 提供 MusicKit on the Web 用于自定义播放器，其初始化需要有效的开发者令牌；Apple 官方说明要求 Apple Developer Program 成员身份。当前项目未配置该凭据，单句练唱仍处于技术验证阶段，不能视为已实现。

参考：[Apple 官方嵌入播放器说明](https://artists.apple.com/support/1117-apple-music-marketing-tools)、[MusicKit on the Web 入门](https://js-cdn.music.apple.com/musickit/v3/docs/iframe.html?path=%2Fstory%2Fget-started--page)。

## 功能边界

这是播放验证阶段。逐句歌词同步、假名开关、单句／选段循环、伴奏尚未接入。播放器页面加载成功不等于歌曲播放或会员登录成功。

原始 iPhone 目标为 iOS 27.0.1。GitHub Pages 解决本站登录门槛，不保证修复 Apple 弹窗、会员授权或锁屏播放问题。

Apple 官方说明：https://artists.apple.com/support/1117-apple-music-marketing-tools
