-- Run once in the project's SQL Editor, or apply with `supabase db push`.
begin;
create table public.kotoba_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.kotoba_members enable row level security;
revoke all on public.kotoba_members from anon, authenticated;
grant select on public.kotoba_members to authenticated;
create policy own_membership on public.kotoba_members for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.kotoba_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null,
  document jsonb not null default '{"version":1,"clock":0,"records":{},"events":{}}',
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id),
  check (octet_length(document::text) <= 8388608)
);
alter table public.kotoba_progress enable row level security;
revoke all on public.kotoba_progress from anon, authenticated;
grant select, insert, update on public.kotoba_progress to authenticated;
create policy own_progress on public.kotoba_progress for all to authenticated
  using ((select auth.uid()) = user_id and exists
    (select 1 from public.kotoba_members m where m.user_id = (select auth.uid())))
  with check ((select auth.uid()) = user_id and exists
    (select 1 from public.kotoba_members m where m.user_id = (select auth.uid())));

create function public.kotoba_merge(p_course text, p_document jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_doc jsonb; rec record; prior jsonb; records jsonb; events jsonb; clock bigint;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  if not exists(select 1 from public.kotoba_members where user_id=auth.uid()) then
    raise exception 'Account not enabled for this notebook';
  end if;
  if p_course !~ '^[a-zA-Z0-9_-]{1,100}$' or
     jsonb_typeof(p_document->'records') is distinct from 'object' or
     jsonb_typeof(p_document->'events') is distinct from 'object' or
     octet_length(p_document::text)>8388608 then raise exception 'Invalid sync document'; end if;
  insert into public.kotoba_progress(user_id,course_id) values(auth.uid(),p_course)
    on conflict do nothing;
  select document into current_doc from public.kotoba_progress
    where user_id=auth.uid() and course_id=p_course for update;
  records:=current_doc->'records'; events:=current_doc->'events'; clock:=coalesce((current_doc->>'clock')::bigint,0);
  for rec in select key,value from jsonb_each(p_document->'records') loop
    if rec.key !~ '^(word|kanji|day):[a-zA-Z0-9_-]{1,100}$' or
       coalesce(rec.value->>'at','') !~ '^[0-9]{1,16}$' or
       (rec.value->>'at')::bigint > 9007199254740991 or
       coalesce(rec.value->>'actor','') !~ '^[a-zA-Z0-9-]{1,80}$' or
       not (rec.value ? 'value') then raise exception 'Invalid sync record'; end if;
    prior:=records->rec.key;
    if prior is null or (rec.value->>'at')::bigint > (prior->>'at')::bigint or
       ((rec.value->>'at')::bigint = (prior->>'at')::bigint and
        (rec.value->>'actor') collate "C" > (prior->>'actor') collate "C") then
      records:=jsonb_set(records,array[rec.key],rec.value,true);
    end if;
    clock:=greatest(clock,(rec.value->>'at')::bigint);
  end loop;
  -- Existing practice IDs are immutable: retries and copied backups are idempotent.
  events:=(p_document->'events') || events;
  current_doc:=jsonb_build_object('version',1,'clock',clock,'records',records,'events',events);
  update public.kotoba_progress set document=current_doc,updated_at=now()
    where user_id=auth.uid() and course_id=p_course;
  return current_doc;
end; $$;
revoke all on function public.kotoba_merge(text,jsonb) from public, anon;
grant execute on function public.kotoba_merge(text,jsonb) to authenticated;

create table public.kotoba_ai_usage (
  user_id uuid references auth.users(id) on delete cascade,
  day date not null,
  requests integer not null default 0,
  primary key(user_id,day)
);
alter table public.kotoba_ai_usage enable row level security;
revoke all on public.kotoba_ai_usage from anon, authenticated;
create function public.kotoba_take_ai_quota(p_user uuid,p_limit integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer; d date := (now() at time zone 'Asia/Shanghai')::date;
begin
  if not exists(select 1 from public.kotoba_members where user_id=p_user) then return false; end if;
  insert into public.kotoba_ai_usage(user_id,day,requests) values(p_user,d,1)
    on conflict(user_id,day) do update set requests=public.kotoba_ai_usage.requests+1
      where public.kotoba_ai_usage.requests < greatest(1,least(p_limit,200))
    returning requests into n;
  return n is not null;
end; $$;
revoke all on function public.kotoba_take_ai_quota(uuid,integer) from public, anon, authenticated;
grant execute on function public.kotoba_take_ai_quota(uuid,integer) to service_role;
commit;
