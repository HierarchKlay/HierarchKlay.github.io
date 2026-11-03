# 在 Mac 本地生成 MusicKit 开发者令牌

此工具用于日々うた的 MusicKit 接入准备，使用 Node.js 自带的加密模块，没有 npm 依赖，不发送网络请求。私钥始终保留在本机。网站版本 06 支持一次配置、多端读取；生成令牌后按下方步骤配置，再在各设备授权 Apple Music。

## 准备

1. 在 Apple Developer 注册启用 MusicKit 的 Media ID，并创建关联的 Media Services 密钥。
2. 下载 `.p8`，记录 Key ID 和会员详情里的 Team ID（两者都是 10 位编号）。
3. 终端运行 `node --version`，使用 Node.js 22 或更新版本。没有 Node 时，从 https://nodejs.org/ 下载 LTS 安装包并重新打开终端。

## 运行

将 `generate-musickit-token.mjs` 下载到电脑，在它所在目录执行：

```sh
node generate-musickit-token.mjs
```

依次输入 Team ID、Key ID，然后在 macOS 文件选择窗口选中下载的 `.p8`。如果文件窗口无法打开，可手动指定路径：

```sh
node generate-musickit-token.mjs --key-file "/完整路径/AuthKey_你的KeyID.p8"
```

脚本生成有效期 30 天的 ES256 JWT，包含 `origin: ["https://hierarchklay.github.io"]`。Origin 是协议和域名，不包含 `/uta/` 路径；这也不是替代用户授权的机制。

默认文件位置为 `~/Library/Application Support/Hibi Uta/musickit-developer-token-时间戳.txt`，输出文件权限为仅当前用户读写，且不会覆盖已有文件。终端只显示保存位置与到期时间，不显示令牌正文。

## 一次配置到网站

打开 [GitHub 共享配置编辑页](https://github.com/HierarchKlay/HierarchKlay.github.io/edit/main/uta/musickit-config.json)，将生成的开发者令牌填入 `developerToken` 双引号内并提交。Pages 发布后，Mac 与 iPhone 刷新本站即可自动读取；无需各自导入。开发者令牌随网站公开提供，仅限填写这一类令牌，`.p8` 私钥和 Apple Music 用户授权令牌始终不上传。

文件路径有空格时必须加引号。例如复制到 Mac 剪贴板：

```sh
pbcopy < "$HOME/Library/Application Support/Hibi Uta/实际生成的文件名.txt"
```

请将示例文件名换成脚本输出的完整文件名。令牌到期后重新生成，在同一配置文件替换一次即可；网站暂不自动续期。手动导入入口仍保留，仅影响当前浏览器。

“本地签名校验通过”只验证签名与所选密钥匹配，不代表 Apple 已认可 Team ID、Key ID、服务权限或用户订阅。接下来需要通过网站配置 MusicKit，并用中国区 Apple Music 账号实测授权、播放进度、跳转和锁屏。开发者令牌不等同于 Music User Token；后者由用户在 Apple 的授权界面同意后，通过 MusicKit 管理。

## 验证

```sh
node --test uta/tools/generate-musickit-token.test.mjs
```

测试使用临时生成的模拟密钥，检查 JWT 签名、域名和期限、错误密钥处理、私有文件权限及不覆盖行为。macOS 文件选择窗口需在 Mac 上实际操作验证。

参考：[Apple 开发者令牌文档](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens)、[创建 Media ID 与私钥](https://developer.apple.com/help/account/capabilities/create-a-media-identifier-and-private-key/)。
