# 日々ことば：连接 Supabase 与 Qwen

当前状态（2026-10-13）：网站已配置用户提供的 Supabase 项目 `mtszdktdpjipjvbspetr` 和 publishable key。用户已完成 `kotoba-ask` 首次部署；只读检查确认函数响应、未登录请求被拒绝，学习表已存在且匿名访问被拒绝。真实登录后的跨端同步和 Qwen 调用仍未验证。本次增加 Anthropic 普通问答兼容性测试，需要拉取新代码后重新部署函数。

## 1. 创建你的 Supabase 项目

打开 https://supabase.com/dashboard ，登录后创建项目，例如 `kotoba`。保存数据库密码，等待项目就绪。

在项目的 Connect / Settings 页面找到：

- Project URL：形如 `https://项目编号.supabase.co`。
- Publishable key：形如 `sb_publishable_...`。旧项目也可使用 `anon` key。

这两项是网页公开配置，可以提供给维护者。不要提供数据库密码、`service_role`、`sb_secret_...` 或个人访问令牌。

## 2. 创建数据库和学习账号

在 SQL Editor 中执行本仓库的 `supabase/migrations/202610120001_cloud.sql`。只执行一次；后续升级用新的迁移文件，不能删除已有数据。

在 Authentication → Users → Add user 创建自己的学习账号，填写邮箱和密码，启用确认邮箱选项。这个密码用于学习网页，不是 Supabase 控制台密码。个人网站可关闭公开注册。

复制刚创建账号的 User UID，在 SQL Editor 执行：

```sql
insert into public.kotoba_members(user_id)
values ('替换成你自己的 User UID')
on conflict do nothing;
```

只有列在 `kotoba_members` 的账号可以同步和使用问答。数据库按用户 ID 隔离数据；公开网页不包含个人学习记录。第一版使用邮箱和密码登录，不依赖邮件发送服务。

## 3. 填写网页公开配置

修改 `kotoba/cloud-config.json`（Sites 源码中对应 `dist/cloud-config.json`）：

```json
{
  "supabaseUrl": "https://你的项目编号.supabase.co",
  "publishableKey": "你的 publishable key",
  "questionFunction": "kotoba-ask"
}
```

配置完成并发布后，手机和电脑分别登录同一学习账号。第一次登录自动合并当前浏览器已有进度。建议在第一次连接前保留一次“导出进度”备份。

每次学习操作先在本地保存，约 1.2 秒后上传；页面回到前台、网络恢复、点击“立即同步”时也会同步，前台每分钟再检查一次。未登录或离线时仍能学习；退出登录保留本机进度。本机进度绑定首次同步成功的账号，避免换账号时混入别人的记录。

同一词汇/汉字的并发修改按记录时间及设备标识确定最后状态；不同词条独立合并。复习日志按唯一 ID 合并，重试不重复计数。“完全掌握”与“恢复待复习”都参与同步。课程顺序同步；当前打开哪一课、哪一张卡、是否显示注音保留为设备偏好。

## 4. 配置 Qwen 接口

私密配置只放 Supabase → Edge Functions → Secrets，不写入网页、GitHub、聊天或截图。

### 本次：用现有 Token Plan Key 验证普通问答

用户明确要求先移除应用对套餐类型的硬拦截并验证技术兼容性。当前代码不再按 `sk-sp-` 前缀或套餐域名拒绝请求；会根据 Base URL 自动选择协议。你提供的 `token-plan.../apps/anthropic` 在官方文档中属于 Token Plan。应用不会冒充 Claude Code，也不会绕过提供方实际返回的认证、权限或额度限制。

在 Secrets 中填写：

| Secret 名称 | 值 |
| --- | --- |
| `DASHSCOPE_API_KEY` | 你现有的真实 Key（不是占位值 `sk-sp-xxx`） |
| `QWEN_BASE_URL` | `https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic` |
| `QWEN_MODEL` | `qwen3.8-max` |
| `AI_DAILY_LIMIT` | `40`（可调整；按北京时间统计调用尝试，失败调用也计入） |
| `ALLOWED_ORIGINS` | `https://hierarchklay.github.io,https://kotoba-daily-demo.hierarch-klay.chatgpt.site` |

`SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase 托管函数提供。Key 只由服务端发给配置的百炼域名，浏览器收不到模型 Key。

代码会发送到 `/apps/anthropic/v1/messages`。先使用最小普通问答配置：非流式、关闭深度思考、不带搜索工具。网站提问前必须取消“联网检索”，可以保留“带上当前词卡”；多轮对话照常传递。未取消联网时会在调用模型前提示，不会偷偷改为未联网回答。

测试步骤：

1. 按第 5 步拉取并重新部署函数。
2. 保存上述 Secrets，打开学习网站并登录已开通的账号。
3. 取消“联网检索”，提问：`用中文简短解释「迎える」，并给一个日语例句。`
4. 若有真实回答，说明本次请求在该 Key、模型和运行环境下成功；还不能据此认定联网功能或长期可用性已经验证。
5. 若显示 `HTTP 401/403/404/429`，记录完整网页错误文字。应用不会自动改客户端身份或换地址重试；不要把 Key 发出来。

官方目前对 Token Plan/Coding Plan 的自建后端使用有范围限制。技术连通性测试结果和套餐允许范围应分别判断，见文末的 Base URL 与“更多工具”官方说明。

### 通用 Responses API：保留原联网问答路径

使用普通百炼 API Key，以及控制台中与 Key 的业务空间、地域一致的 OpenAI 兼容 Base URL，例如：

```text
https://你的WorkspaceId.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
```

准确值以控制台为准。设置相同的 `DASHSCOPE_API_KEY`、`QWEN_BASE_URL`、`QWEN_MODEL` 即可自动走 `/responses`；可以勾选联网，服务端通过 `web_search` 请求真实搜索并解析来源。该路径按普通 API 计费，不消耗套餐额度。切换配置后，是否真正执行检索仍以返回的调用和来源证据为准。

## 5. 部署问答函数

首次部署可以在终端执行下面命令（本地需有 Git、Node.js 20 或更新；选择不存在的本地目录名 `kotoba-setup`）：

```bash
git clone --depth 1 https://github.com/HierarchKlay/HierarchKlay.github.io.git kotoba-setup
cd kotoba-setup/kotoba-source
npx supabase login
npx supabase functions deploy kotoba-ask --project-ref mtszdktdpjipjvbspetr
```

`supabase/config.toml` 已设置函数入口不使用旧式网关 JWT 校验；函数内部会通过 Supabase Auth `/user` 验证每次访问令牌，并通过服务端权限表与额度检查决定是否调用模型。不能删除这些验证或把函数改成公开代理。

已经执行过首次部署的用户，在现有 `kotoba-setup/kotoba-source` 目录执行：

```bash
git pull --ff-only
npx supabase functions deploy kotoba-ask --project-ref mtszdktdpjipjvbspetr
```

不需要再次创建数据库或复制学习进度。仅保存 Secrets 不会把旧函数代码更新成新版，必须完成上面的重新部署。

如果在 Dashboard 编辑器部署，需同时添加 `index.ts` 和同目录 `logic.mjs`，并保持同样的 JWT 配置。

## 6. 接通后检查

1. 手机登录，给一个词点“记住了”；电脑登录后确认状态、复习日期和统计一致。
2. 电脑点“完全掌握”，手机同步后确认排除并补位；恢复该词，确认旧设备不会重新排除它。
3. 两端短暂离线，各学不同词，恢复网络后确认两份记录都保留。
4. 网页底部提问，确认真实回答和来源；没有执行搜索时会明确显示，而不会伪装为已联网。
5. 检查浏览器网络请求和仓库：只能看到 publishable key 与当前用户会话令牌，不能出现百炼 Key 或 Supabase 管理密钥。

问答历史只保留在当前页面，点击新对话或刷新后清空；不会自动同步聊天记录。界面默认联网开启；Anthropic 兼容性测试需取消，Responses 模式可以保留，但模型可能判断无需搜索。页面以服务端返回的真实搜索调用/来源为依据标记状态。

## 验证与维护

已提供 `test_cloud.mjs`、`test_endpoint.mjs` 和 `test_database.mjs`。数据库测试使用嵌入式 PostgreSQL（PGlite），验证合并、账号隔离和额度；接口测试使用模拟模型响应。仅通过模拟接口测试，不能据此声称真实 Key 或百炼端到端调用已通过。

```bash
node test_core.mjs
node test_app.mjs
node test_cloud.mjs
node test_endpoint.mjs
# 可选数据库验证依赖；不在浏览器中使用
npm install --no-save @electric-sql/pglite
node test_database.mjs
```

云同步启用后，网页统计使用合并记录；后台 ChatGPT 维护任务仍没有自动获得私有数据库读取凭证，不会凭空生成个人学习报告。课程自动更新继续按照 `MAINTENANCE.md` 执行，必须保留云端配置和稳定词条 ID。

参考官方文档：
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/functions/deploy
- https://help.aliyun.com/zh/model-studio/web-search
- https://help.aliyun.com/zh/model-studio/coding-plan-faq

- https://help.aliyun.com/zh/model-studio/anthropic-api-messages
- https://help.aliyun.com/zh/model-studio/base-url
- https://help.aliyun.com/zh/model-studio/more-tools
