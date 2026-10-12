日々ことば · 日语词汇手帖

第一周试用课：7天，每天35核心词，另有10备用词，共315个不同词条。
默认展示常用写法；少见字形仅作旁注。例句为原创学习示例，未逐条母语审校。

网页为无依赖静态HTML / CSS / JavaScript。
dist/core.mjs 处理稳定课程、永久掌握、备用补位、状态迁移、间隔复习及读音判定。
dist/app-v3.js 处理学习卡、词库/恢复、汉字小注、5种练习及混合练习。
进度存在当前浏览器 localStorage，可手动导出/导入JSON，不会自动跨设备同步。
v3会迁移原12词小样的ratings，不会把“记住了”擅自升级为“完全掌握”。
课程手动切换，不按时钟自动跳课，不设置提醒。复习到期按Asia/Shanghai日期判断。
自动补位优先本课10词，再使用其他课未占用备用词；不借用未来核心词。
所有70个备用词耗尽会明确提示。永久掌握可恢复到待复习，不挤掉已补位词。
间隔复习：again当天，familiar隔天，known按3/7/14/30/60天；同日重复答对不升级间隔。
语音使用浏览器自带的日语 speechSynthesis；设备没有日语语音时会提示。
课程编排固定随机种子；手动打乱不影响自评。填空给目标读音，避免近义歧义。
下载PDF固定第1课35+10词；浏览器打印包含当前课程补位后的实际词目。

PDF重新生成（Python需要 reportlab）：
python3 build_course.py
python3 build_v3_pdf.py --out dist/kotoba-sample.pdf

source-fonts 是覆盖当前内容的 Noto Sans SC / JP 400 字重子集。
增加新字时应使用 build_fonts.py --full-font-dir <full fonts> 重新生成字体子集。
字体许可见 dist/assets/font-license-*.txt。

验证：node test_core.mjs；node test_app.mjs（轻量DOM替身，不是浏览器测试）；JS语法；PDF逐页渲染。
当前环境未提供 Sites 所需的浏览器控制能力，未进行浏览器实机操作或设备语音测试。

源数据 source-data/ 含逐词来源、OJAD词头证据及未核对标记；不把缺失声调视为0。
资料来源与内容范围见网页“说明与来源”和PDF末页。

2026-10-13 v0.5：已准备 Supabase 云同步、底部日语问答及部署文件，尚待项目配置和普通百炼 API Key。当前仍为本机存档。完整配置见 SUPABASE-SETUP.md。语音现已提供 630 段预生成音频，旧版系统朗读为备用方案。
