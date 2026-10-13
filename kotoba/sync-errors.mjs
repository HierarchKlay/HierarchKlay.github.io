// Show actionable errors without exposing session tokens or progress payloads.
function cleanMessage(value){
  return String(value||'未知错误')
    .replace(/Bearer\s+\S+/gi,'Bearer [已隐藏]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[令牌已隐藏]')
    .replace(/\b(?:sb_(?:secret|publishable)_|sk-)[A-Za-z0-9_-]+/g,'[密钥已隐藏]')
    .replace(/https?:\/\/\S+/gi,'[请求地址已隐藏]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[邮箱已隐藏]')
    .replace(/[\r\n\t]+/g,' ').slice(0,260);
}
export function describeSyncError(error={},httpStatus=0,phase='request'){
  const message=String(error?.message||error||''),rawCode=String(error?.code||'');
  const code=/^[A-Z0-9_]{1,32}$/.test(rawCode)?rawCode:'';
  let reason='同步未成功，请展开错误详情',kind='unknown';
  if(/Account not enabled/i.test(message)){reason='此账号尚未开通学习同步，请检查账号授权';kind='membership';}
  else if(code==='42501'){reason='数据库拒绝同步权限，请检查登录角色和数据库授权';kind='permission';}
  else if(httpStatus===401||['PGRST301','PGRST302','PGRST303'].includes(code)||/JWT expired|invalid JWT|Login required/i.test(message)){reason='登录已过期或令牌无效，请退出后重新登录';kind='auth';}
  else if(['PGRST202','PGRST203','PGRST205','42P01','42883'].includes(code)){reason='云端同步函数或数据表配置不完整，请检查数据库初始化';kind='schema';}
  else if(/Invalid sync (document|record)/i.test(message)||['22023','22P02','23514'].includes(code)){reason='同步记录未通过云端格式校验，请保留进度并反馈错误详情';kind='data';}
  else if(httpStatus===413||code==='54000'){reason='同步数据超出服务限制，请先导出进度并反馈错误详情';kind='size';}
  else if(error?.name==='TimeoutError'||error?.name==='AbortError'||/timeout|timed out|aborted/i.test(message)||code==='57014'){reason='同步请求超时，请检查网络后重试';kind='timeout';}
  else if(/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(message)){reason='无法连接云端，请检查网络后重试';kind='network';}
  else if(httpStatus>=500){reason='云端服务暂时异常，请稍后重试';kind='server';}
  else if(phase==='merge'){reason='云端返回或本机合并异常，请保留进度并反馈错误详情';kind='merge';}
  const marker=code|| (httpStatus?`HTTP ${httpStatus}`:kind.toUpperCase());
  const summary=`${reason}（${marker}）。进度保留在本机。`;
  // Omit Postgres details/hint: they may contain rows or suggest anon grants.
  const details=[`同步诊断版本：2026-10-13.1`,`阶段：${phase==='merge'?'合并返回数据':'调用 kotoba_merge'}`,
    `HTTP：${Number(httpStatus)||'未取得响应'}`,`错误码：${code||'无'}`,`原因：${cleanMessage(message)}`,
    '不包含邮箱、登录令牌或学习记录。'].join('\n');
  return {kind,summary,details};
}
