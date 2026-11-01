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

## 功能边界

这是播放验证阶段。逐句歌词同步、假名开关、单句／选段循环、伴奏尚未接入。播放器页面加载成功不等于歌曲播放或会员登录成功。

原始 iPhone 目标为 iOS 27.0.1。GitHub Pages 解决本站登录门槛，不保证修复 Apple 弹窗、会员授权或锁屏播放问题。

Apple 官方说明：https://artists.apple.com/support/1117-apple-music-marketing-tools
