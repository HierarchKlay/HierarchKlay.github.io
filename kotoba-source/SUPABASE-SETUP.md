# 日々ことば：连接 Supabase 与 Qwen

当前状态（2026-10-13）：网站已填写用户提供的 Supabase 项目 `mtszdktdpjipjvbspetr` 和 publishable key。Auth 接口验证通过；检查时学习表 `kotoba_progress` 尚未创建，`kotoba-ask` 函数尚未部署。继续完成第 2、4、5 步即可；建项目和填写网页公开配置已经完成。尚未验证真实登录后的同步或 Qwen 调用。

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

## 4. 配置普通百炼 API

`qwen3.8-max` 支持联网搜索。本应用通过通用 **Responses API** 请求 `web_search`，不冒用 Claude Code 客户端身份。

你提供的 `token-plan.../apps/anthropic` 和 `sk-sp-...` 是 Coding Plan 专用接口，不能用于自建网页后台。请在百炼控制台创建普通 API Key，并复制该业务空间、地域对应的 OpenAI 兼容 Base URL。北京新接口的形式为：

```text
https://你的WorkspaceId.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
```

准确值以你的百炼控制台为准；不要把上面的占位文字直接当作地址。模型和联网检索按普通 API 计费，不消耗 Coding Plan 套餐额度。

在 Supabase → Edge Functions → Secrets 添加：

| Secret 名称 | 值 |
| --- | --- |
| `DASHSCOPE_API_KEY` | 普通百炼 API Key，不能是 `sk-sp-...` |
| `QWEN_BASE_URL` | 普通接口的完整 Base URL，不带 `/responses` |
| `QWEN_MODEL` | `qwen3.8-max` |
| `AI_DAILY_LIMIT` | `40`（可调整；按北京时间统计请求尝试次数，失败调用也计入） |
| `ALLOWED_ORIGINS` | `https://hierarchklay.github.io,https://kotoba-daily-demo.hierarch-klay.chatgpt.site` |

`SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase 托管函数提供。所有以上私密配置只放 Secrets，不写入网页、GitHub、聊天或截图。

## 5. 部署问答函数

首次部署可以在终端执行下面命令（本地需有 Git、Node.js 20 或更新；选择不存在的本地目录名 `kotoba-setup`）：

```bash
git clone --depth 1 https://github.com/HierarchKlay/HierarchKlay.github.io.git kotoba-setup
cd kotoba-setup/kotoba-source
npx supabase login
npx supabase functions deploy kotoba-ask --project-ref mtszdktdpjipjvbspetr
```

`supabase/config.toml` 已设置函数入口不使用旧式网关 JWT 校验；函数内部会通过 Supabase Auth `/user` 验证每次访问令牌，并通过服务端权限表与额度检查决定是否调用模型。不能删除这些验证或把函数改成公开代理。

如果在 Dashboard 编辑器部署，需同时添加 `index.ts` 和同目录 `logic.mjs`，并保持同样的 JWT 配置。

## 6. 接通后检查

1. 手机登录，给一个词点“记住了”；电脑登录后确认状态、复习日期和统计一致。
2. 电脑点“完全掌握”，手机同步后确认排除并补位；恢复该词，确认旧设备不会重新排除它。
3. 两端短暂离线，各学不同词，恢复网络后确认两份记录都保留。
4. 网页底部提问，确认真实回答和来源；没有执行搜索时会明确显示，而不会伪装为已联网。
5. 检查浏览器网络请求和仓库：只能看到 publishable key 与当前用户会话令牌，不能出现百炼 Key 或 Supabase 管理密钥。

问答历史只保留在当前页面，点击新对话或刷新后清空；不会自动同步聊天记录。默认联网开启，但模型可能判断无需搜索。页面以服务端返回的真实搜索调用/来源为依据标记状态。

## 验证与维护

已提供 `test_cloud.mjs`、`test_endpoint.mjs` 和 `test_database.mjs`。数据库测试使用嵌入式 PostgreSQL（PGlite），验证合并、账号隔离和额度；接口测试使用模拟模型响应。没有真实项目与普通 API Key 时，不能据此声称实机登录或百炼端到端调用已通过。

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
