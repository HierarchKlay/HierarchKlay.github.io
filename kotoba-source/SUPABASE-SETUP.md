# 日々ことば：连接 Supabase 与 Qwen

当前状态（2026-10-13）：用户已确认 Token Plan + `qwen3.8-max` 的普通问答能正常回复。最新代码增加 Anthropic 联网搜索验证、Markdown 渲染和日语助教预设。前端随网站发布生效；后端需要拉取并重新部署 `kotoba-ask`。真实联网检索仍等待使用用户现有 Key 验证，不能把普通问答成功或模拟测试通过当作联网成功。跨端同步仍需实际账号验证。

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

### 本次：沿用现有 Token Plan Key 验证联网搜索

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

代码会发送到 `/apps/anthropic/v1/messages`。不勾选联网时保持此前已实测成功的普通问答配置。勾选联网时，按百炼官方《联网搜索》的 SDK/HTTP 示例添加 `web_search_20250305` 服务端工具及其要求的 system 兼容标记，单次最多 3 次搜索。没有模拟其他客户端的 User-Agent，也不会在提供方拒绝请求后换身份重试。

测试步骤：

1. 按第 5 步拉取并重新部署函数；现有三个 Qwen Secrets 不需要改。
2. 刷新学习网站并登录，勾选“联网检索”，模式保持“日语助教”。
3. 提问：`请联网查日语词典中「迎える」的常用义，给两个例句，并附实际检索到的来源链接。`
4. 回答下方应显示“已联网检索”和来源链接。成功状态仅根据结构化检索结果、引用、工具调用计数判断，回答正文中的“我查到了”或普通链接不算证据。
5. 若显示“未触发联网检索”“未收到成功结果”或“联网检索失败”，记录具体状态；不要把这次回答当作已联网核实。部分成功会单独标注。若显示 `HTTP 401/403/404/429`，记录网页错误文字，不要发送 Key。

`server_tool_use` 只表示发起检索，不能单独证明成功；工具返回错误时不能因计数大于零就标成成功。来源来自 `web_search_tool_result` / 结构化引用，去重并只保留 HTTP(S) 链接。未完成的模型输出会提示继续追问。

### 日语助教与 Markdown

默认系统提示词在 `supabase/functions/kotoba-ask/prompts.mjs`。每次请求自动附加，不需要用户重复说明是在学日语。包含：中文讲解、常用写法、例句读音与译文、搭配和语体、声调不猜测、检索来源与不确定性说明、简洁 Markdown。前端可选“日语助教 / 词义辨析 / 语法解析 / 句子纠错”；未知模式会回退默认，不能从浏览器注入任意系统提示词。

网页内置 Marked + DOMPurify，支持标题、加粗、列表、引用、代码和表格。表格可横向滚动。原始 HTML 和图片作为惰性文本处理，危险链接不可点击；这些库随网站自托管，不依赖外部 CDN。

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

如果在 Dashboard 编辑器部署，需同时添加 `index.ts`、同目录 `logic.mjs` 和 `prompts.mjs`，并保持同样的 JWT 配置。

## 6. 接通后检查

1. 手机登录，给一个词点“记住了”；电脑登录后确认状态、复习日期和统计一致。
2. 电脑点“完全掌握”，手机同步后确认排除并补位；恢复该词，确认旧设备不会重新排除它。
3. 两端短暂离线，各学不同词，恢复网络后确认两份记录都保留。
4. 网页底部提问，确认真实回答和来源；没有执行搜索时会明确显示，而不会伪装为已联网。
5. 检查浏览器网络请求和仓库：只能看到 publishable key 与当前用户会话令牌，不能出现百炼 Key 或 Supabase 管理密钥。

问答历史只保留在当前页面，点击新对话或刷新后清空；不会自动同步聊天记录。界面默认联网开启；Anthropic 和 Responses 两种模式均请求实际检索，但模型可能未触发工具，或工具可能失败。页面以服务端返回的真实搜索调用/来源为依据标记状态。

## 手机登录失败时如何诊断

电脑和手机使用同一个 Supabase 学习账号。电脑仍显示已登录，可能只是沿用旧会话，不代表此次输入的密码已重新验证；不必先退出电脑或清空学习进度。

手机刷新后，确认密码框旁有“显示密码”按钮，再尝试一次登录。必要时用英文键盘手动输入，核对自动填充、大小写和空格；密码会原样发送，不自动删空格或转换字符。失败时展开“登录错误详情”，只反馈其中的文字，不发送密码或含明文密码的截图。

- `invalid_credentials`：服务端未接受本次邮箱/密码，先核对与电脑登录区显示的学习账号邮箱一致。网站学习账号不是 Supabase 管理后台账号。
- `email_not_confirmed`：学习账号未完成邮箱验证。
- `NETWORK` / `TIMEOUT`：手机未能连接服务或超时，切换 Wi-Fi / 移动网络，并用 Safari / Chrome 直接打开同一学习网址后重试。
- `over_request_rate_limit` / HTTP 429：等待几分钟再试，避免连续点击。
- 其他错误：根据详情中的 HTTP / 错误码定位，不先重置账号或改数据库权限。

这只是前端诊断改进，无需重部署 Supabase 函数。没有用户端的真实错误码时，不能认定密码有误或问题已修复。

## 同步失败时如何诊断

如果点击“立即同步”失败，展开登录区下方的“同步错误详情”，提供 HTTP 状态、错误码和原因。不要清空本地存储，不必重跑初始 SQL，也不需要因此重新部署问答函数；学习同步调用的是数据库 RPC `kotoba_merge`。

- `42501`：数据库授权或 RLS 拒绝。保留安全策略，检查实际登录角色、函数 execute 权限、表权限和账号会员记录。匿名探测被拒绝是预期行为，不代表已登录账号也缺权限，不能据此给 anon 授权。
- `PGRST301/302/303` 或登录令牌无效：退出网页账号后重新登录，再同步；保留本机进度。
- `PGRST202/205`、`42P01`、`42883`：函数、表或 API schema 配置未完成。
- `P0001` 且原因为 `Account not enabled...`：检查 `kotoba_members` 的账号 UID。
- `P0001` 且原因为 `Invalid sync record/document`：进度格式被云端拒绝，先保留备份并反馈；不要删除记录以试错。
- 网络错误或超时：换网络后重试，仍失败时提供页面的错误详情。

页面只展示经过脱敏的错误摘要，不包含服务端返回的完整行数据或授权建议。首次同步尚未成功前，云端不应被视作已备份。维护者可以检查公开接口与本地模拟数据库，但没有用户登录凭证时不能验证该账号的真实 RPC 结果。

## 验证与维护

已提供 `test_cloud.mjs`、`test_endpoint.mjs`、`test_tutor.mjs` 和 `test_database.mjs`。数据库测试使用嵌入式 PostgreSQL（PGlite），验证合并、账号隔离和额度；接口测试使用模拟模型响应。仅通过模拟接口测试，不能据此声称真实 Key 或百炼端到端调用已通过。

```bash
node test_core.mjs
node test_app.mjs
node test_cloud.mjs
node test_endpoint.mjs
node test_sync_errors.mjs
# Markdown 的 DOM 安全验证（Node.js 24，测试依赖不在浏览器中使用）
npm install --no-save --ignore-scripts jsdom@30.1.2
node test_tutor.mjs
node test_sync_ui.mjs
node test_auth.mjs
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
