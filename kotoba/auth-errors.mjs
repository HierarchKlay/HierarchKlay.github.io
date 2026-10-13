// Only expose known explanations and structured codes, never raw auth responses.
export function describeAuthError(error={}){
  const rawCode=String(error?.code||'');
  const code=/^[a-z][a-z0-9_]{0,63}$/.test(rawCode)?rawCode:'';
  const http=Number(error?.status)||0,message=String(error?.message||'');
  let kind='unknown',reason='登录未成功，请展开登录错误详情反馈';
  if(code==='invalid_credentials'||/invalid login credentials/i.test(message)){
    kind='credentials';reason='邮箱或密码未通过验证，请核对手机自动填充、大小写和空格';
  }else if(code==='email_not_confirmed'||/email not confirmed/i.test(message)){
    kind='confirmation';reason='此账号的邮箱尚未验证，请先完成邮箱验证';
  }else if(http===429||code.startsWith('over_')){
    kind='rate_limit';reason='登录请求过于频繁，请等几分钟再试';
  }else if(code==='request_timeout'||['TimeoutError','AbortError'].includes(error?.name)||/timed?\s*out|timeout/i.test(message)){
    kind='timeout';reason='登录连接超时，请切换 Wi-Fi 或移动网络后重试';
  }else if(/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(message)||(!http&&error?.name==='AuthRetryableFetchError')){
    kind='network';reason='未能连接登录服务，请切换 Wi-Fi 或移动网络后重试';
  }else if(['SecurityError','QuotaExceededError'].includes(error?.name)){
    kind='storage';reason='浏览器无法保存登录状态，请使用允许网站存储的普通浏览器窗口';
  }else if(code==='user_banned'){
    kind='account';reason='此学习账号已被停用，请检查 Supabase 中的账号状态';
  }else if(['email_provider_disabled','provider_disabled'].includes(code)){
    kind='configuration';reason='云端未启用邮箱密码登录，请检查登录服务配置';
  }else if(code==='captcha_failed'){
    kind='captcha';reason='登录服务要求人机验证，当前页面尚未接入，请反馈此错误';
  }else if(http>=500){
    kind='server';reason='登录服务暂时异常，请稍后重试';
  }
  const marker=code||(http?`HTTP ${http}`:kind.toUpperCase());
  return {kind,summary:`${reason}（${marker}）。`,details:[
    '登录诊断版本：2026-10-13.2',`HTTP：${http||'未取得响应'}`,
    `错误码：${code||'无'}`,`分类：${kind}`,`说明：${reason}`,
    '此详情不包含邮箱、密码、登录令牌或学习记录。'
  ].join('\n')};
}
