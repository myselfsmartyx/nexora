-- =====================================================================================
-- Nexora — My Journal overhaul
-- Adds: folders, colored tags, archive, private (end-to-end encrypted) entries, a vault
-- for the encryption key, AI weekly reflections, scalable list/stats RPCs, and
-- server-side Free-plan limits.
--
-- Safe to re-run. Apply in the Supabase SQL editor (runs as the table owner).
-- Nothing here deletes or rewrites user content. Tags are lower-cased once (see step 3).
-- =====================================================================================

-- ---------- 0. Plan helper (never exposed to the browser) ----------------------------
create or replace function public.journal_is_pro(p_user uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select s.is_active and s.plan_tier is not null and s.plan_tier <> 'free'
       from public.subscriptions s where s.user_id = p_user limit 1),
    false)
$$;
revoke all on function public.journal_is_pro(uuid) from public, anon, authenticated;

create or replace function public.journal_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ---------- 1. Folders ------------------------------------------------------------------
create table if not exists public.journal_folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  emoji       text not null default '📓' check (char_length(emoji) <= 8),
  color       text not null default '#00D4AA' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_private  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists journal_folders_user_name_uq on public.journal_folders (user_id, lower(btrim(name)));
create index if not exists journal_folders_user_idx on public.journal_folders (user_id, sort_order, created_at);

alter table public.journal_folders enable row level security;
drop policy if exists journal_folders_select on public.journal_folders;
drop policy if exists journal_folders_insert on public.journal_folders;
drop policy if exists journal_folders_update on public.journal_folders;
drop policy if exists journal_folders_delete on public.journal_folders;
create policy journal_folders_select on public.journal_folders for select to authenticated using ((select auth.uid()) = user_id);
create policy journal_folders_insert on public.journal_folders for insert to authenticated with check ((select auth.uid()) = user_id);
create policy journal_folders_update on public.journal_folders for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy journal_folders_delete on public.journal_folders for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists journal_folders_touch on public.journal_folders;
create trigger journal_folders_touch before update on public.journal_folders
  for each row execute function public.journal_touch_updated_at();

-- Free plan: 3 folders, no private folders. Existing folders are NEVER locked after a downgrade —
-- the guard only blocks creating more / turning "private" on.
create or replace function public.journal_folders_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if tg_op = 'INSERT' then
    if not public.journal_is_pro(new.user_id) then
      select count(*) into v_count from public.journal_folders where user_id = new.user_id;
      if v_count >= 3 then raise exception 'nexora_limit:folders'; end if;
    end if;
  end if;
  if new.is_private and (tg_op = 'INSERT' or old.is_private is distinct from true)
     and not public.journal_is_pro(new.user_id) then
    raise exception 'nexora_limit:private_folders';
  end if;
  return new;
end $$;
drop trigger if exists journal_folders_guard_trg on public.journal_folders;
create trigger journal_folders_guard_trg before insert or update on public.journal_folders
  for each row execute function public.journal_folders_guard();

-- ---------- 2. Tags (name + color; entries keep storing tag names in tags text[]) ---------
create table if not exists public.journal_tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 30 and name = lower(btrim(name))),
  color       text not null default '#00D4AA' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.journal_tags enable row level security;
drop policy if exists journal_tags_select on public.journal_tags;
drop policy if exists journal_tags_insert on public.journal_tags;
drop policy if exists journal_tags_update on public.journal_tags;
drop policy if exists journal_tags_delete on public.journal_tags;
create policy journal_tags_select on public.journal_tags for select to authenticated using ((select auth.uid()) = user_id);
create policy journal_tags_insert on public.journal_tags for insert to authenticated with check ((select auth.uid()) = user_id);
create policy journal_tags_update on public.journal_tags for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy journal_tags_delete on public.journal_tags for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- 3. Entry columns -------------------------------------------------------------
alter table public.journal_entries
  add column if not exists folder_id   uuid references public.journal_folders(id) on delete set null,
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists is_locked   boolean not null default false,
  add column if not exists preview     text;

-- One-time cleanup without touching updated_at: lower-case tags, backfill previews.
alter table public.journal_entries disable trigger user;
update public.journal_entries
   set tags = (select coalesce(array_agg(x order by o), '{}')
                 from (select x, min(o) o
                         from (select lower(btrim(t)) x, o from unnest(tags) with ordinality as u(t, o)) q
                        where x <> '' group by x) s)
 where tags is not null and tags <> '{}'
   and tags is distinct from (select coalesce(array_agg(x order by o), '{}')
                 from (select x, min(o) o
                         from (select lower(btrim(t)) x, o from unnest(tags) with ordinality as u(t, o)) q
                        where x <> '' group by x) s);
update public.journal_entries set preview = left(content, 280)
 where not is_locked and preview is distinct from left(content, 280);
alter table public.journal_entries enable trigger user;

create index if not exists journal_entries_user_archived_date_idx
  on public.journal_entries (user_id, is_archived, entry_date desc, created_at desc);
create index if not exists journal_entries_user_folder_idx
  on public.journal_entries (user_id, folder_id, entry_date desc) where not is_archived;
create index if not exists journal_entries_user_locked_idx
  on public.journal_entries (user_id) where is_locked;
create index if not exists journal_entries_user_updated_idx
  on public.journal_entries (user_id, updated_at desc);

-- Runs after the existing triggers (alphabetical order), so it has the last word.
create or replace function public.journal_entries_prepare()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_locked integer;
begin
  if new.is_locked then
    -- Private entries: title/content live inside an encrypted payload. Leak nothing readable.
    new.title := null;
    new.preview := null;
    new.word_count := 0;
    if (tg_op = 'INSERT' or old.is_locked is distinct from true)
       and not public.journal_is_pro(new.user_id) then
      select count(*) into v_locked from public.journal_entries
        where user_id = new.user_id and is_locked and id <> new.id;
      if v_locked >= 5 then raise exception 'nexora_limit:private_entries'; end if;
    end if;
  else
    new.preview := left(new.content, 280);
  end if;

  if new.is_archived then
    if tg_op = 'INSERT' or old.is_archived is distinct from true then new.archived_at := now(); end if;
  else
    new.archived_at := null;
  end if;

  -- A folder must belong to the same user.
  if new.folder_id is not null and not exists (
      select 1 from public.journal_folders f where f.id = new.folder_id and f.user_id = new.user_id) then
    new.folder_id := null;
  end if;
  return new;
end $$;
drop trigger if exists zz_journal_entries_prepare on public.journal_entries;
create trigger zz_journal_entries_prepare before insert or update on public.journal_entries
  for each row execute function public.journal_entries_prepare();

-- ---------- 4. Vault (the encrypted key; the passphrase never leaves the device) ----------
create table if not exists public.journal_vault (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  kdf_salt         text not null,
  kdf_iter         integer not null check (kdf_iter between 100000 and 5000000),
  wrapped_key      text not null,   -- master key encrypted with a key derived from the passphrase
  rec_salt         text not null,
  rec_wrapped_key  text not null,   -- master key encrypted with a key derived from the recovery key
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.journal_vault enable row level security;
drop policy if exists journal_vault_select on public.journal_vault;
drop policy if exists journal_vault_insert on public.journal_vault;
drop policy if exists journal_vault_update on public.journal_vault;
drop policy if exists journal_vault_delete on public.journal_vault;
create policy journal_vault_select on public.journal_vault for select to authenticated using ((select auth.uid()) = user_id);
create policy journal_vault_insert on public.journal_vault for insert to authenticated with check ((select auth.uid()) = user_id);
create policy journal_vault_update on public.journal_vault for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy journal_vault_delete on public.journal_vault for delete to authenticated using ((select auth.uid()) = user_id);
drop trigger if exists journal_vault_touch on public.journal_vault;
create trigger journal_vault_touch before update on public.journal_vault
  for each row execute function public.journal_touch_updated_at();

-- ---------- 5. AI weekly reflections (written only by the journal-ai Edge Function) --------
create table if not exists public.journal_reflections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  entry_count   integer not null default 0,
  content       jsonb not null,
  created_at    timestamptz not null default now()
);
create index if not exists journal_reflections_user_idx on public.journal_reflections (user_id, created_at desc);
alter table public.journal_reflections enable row level security;
drop policy if exists journal_reflections_select on public.journal_reflections;
drop policy if exists journal_reflections_delete on public.journal_reflections;
create policy journal_reflections_select on public.journal_reflections for select to authenticated using ((select auth.uid()) = user_id);
create policy journal_reflections_delete on public.journal_reflections for delete to authenticated using ((select auth.uid()) = user_id);
-- (no insert/update policy on purpose: users can't forge reflections)

-- ---------- 6. RPCs (security invoker → RLS always applies) --------------------------------
create or replace function public.journal_overview(p_today date default current_date)
returns jsonb language sql stable security invoker set search_path = public as $$
  with e as (
    select entry_date, mood::text as mood, is_favorite, is_archived, is_locked, folder_id, word_count
      from public.journal_entries where user_id = auth.uid()
  ),
  act  as (select * from e where not is_archived),
  days as (select distinct entry_date d from act),
  grp  as (select d, d - (row_number() over (order by d))::int as g from days),
  runs as (select g, count(*) len, max(d) last_d from grp group by g)
  select jsonb_build_object(
    'total',       (select count(*) from act),
    'archived',    (select count(*) from e where is_archived),
    'favorites',   (select count(*) from act where is_favorite),
    'locked',      (select count(*) from e where is_locked),
    'words',       coalesce((select sum(word_count) from act), 0),
    'active_days', (select count(*) from days),
    'moods',       coalesce((select jsonb_object_agg(mood, c) from (select mood, count(*) c from act where mood is not null group by mood) m), '{}'::jsonb),
    'folders',     coalesce((select jsonb_object_agg(folder_id::text, c) from (select folder_id, count(*) c from act where folder_id is not null group by folder_id) f), '{}'::jsonb),
    'unfiled',     (select count(*) from act where folder_id is null),
    'streak',      coalesce((select len from runs where last_d >= p_today - 1 order by last_d desc limit 1), 0),
    'best_streak', coalesce((select max(len) from runs), 0)
  )
$$;

create or replace function public.journal_tag_stats()
returns table(tag text, uses bigint, color text)
language sql stable security invoker set search_path = public as $$
  with used as (
    select t as tag, count(*) as uses
      from public.journal_entries e, unnest(e.tags) t
     where e.user_id = auth.uid() and t <> ''
     group by t
  )
  select coalesce(u.tag, jt.name) as tag, coalesce(u.uses, 0)::bigint as uses, jt.color
    from used u
    full join (select name, color from public.journal_tags where user_id = auth.uid()) jt on jt.name = u.tag
   order by 2 desc, 1
$$;

create or replace function public.journal_rename_tag(p_old text, p_new text)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_old text := lower(btrim(p_old));
  v_new text := lower(btrim(p_new));
begin
  if v_new is null or v_new = '' or char_length(v_new) > 30 then
    raise exception 'Invalid tag name';
  end if;
  if v_old = v_new then return; end if;

  update public.journal_entries e
     set tags = (select coalesce(array_agg(x order by o), '{}')
                   from (select x, min(o) o
                           from unnest(array_replace(e.tags, v_old, v_new)) with ordinality as u(x, o)
                          group by x) s)
   where e.user_id = auth.uid() and v_old = any(e.tags);

  if exists (select 1 from public.journal_tags where user_id = auth.uid() and name = v_new) then
    delete from public.journal_tags where user_id = auth.uid() and name = v_old;
  else
    update public.journal_tags set name = v_new where user_id = auth.uid() and name = v_old;
  end if;
end $$;

create or replace function public.journal_delete_tag(p_name text)
returns void language plpgsql security invoker set search_path = public as $$
declare v text := lower(btrim(p_name));
begin
  update public.journal_entries set tags = array_remove(tags, v)
   where user_id = auth.uid() and v = any(tags);
  delete from public.journal_tags where user_id = auth.uid() and name = v;
end $$;

create or replace function public.journal_daily_stats(p_from date, p_to date)
returns table(entry_date date, entries integer, words integer, top_mood text, mood_score numeric)
language sql stable security invoker set search_path = public as $$
  select e.entry_date,
         count(*)::int,
         coalesce(sum(e.word_count), 0)::int,
         (mode() within group (order by e.mood::text)),
         avg(case e.mood::text when 'excited' then 5 when 'happy' then 4 when 'reflective' then 3
                               when 'neutral' then 3 when 'stressed' then 1 end)
    from public.journal_entries e
   where e.user_id = auth.uid() and not e.is_archived
     and e.entry_date between p_from and p_to
   group by e.entry_date
   order by e.entry_date
$$;

create or replace function public.journal_on_this_day(p_today date)
returns table(id uuid, title text, preview text, entry_date date, mood text, is_locked boolean, years_ago integer)
language sql stable security invoker set search_path = public as $$
  select e.id, e.title, e.preview, e.entry_date, e.mood::text, e.is_locked,
         (extract(year from p_today) - extract(year from e.entry_date))::int
    from public.journal_entries e
   where e.user_id = auth.uid() and not e.is_archived and e.entry_date < p_today
     and to_char(e.entry_date, 'MM-DD') = to_char(p_today, 'MM-DD')
   order by e.entry_date desc
   limit 6
$$;

create or replace function public.journal_neighbors(p_id uuid)
returns table(prev_id uuid, next_id uuid)
language sql stable security invoker set search_path = public as $$
  with cur as (
    select entry_date d, created_at c, is_archived a
      from public.journal_entries where id = p_id and user_id = auth.uid()
  )
  select
    (select e.id from public.journal_entries e, cur
      where e.user_id = auth.uid() and e.is_archived = cur.a
        and (e.entry_date, e.created_at) < (cur.d, cur.c)
      order by e.entry_date desc, e.created_at desc limit 1),
    (select e.id from public.journal_entries e, cur
      where e.user_id = auth.uid() and e.is_archived = cur.a
        and (e.entry_date, e.created_at) > (cur.d, cur.c)
      order by e.entry_date asc, e.created_at asc limit 1)
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'journal_overview(date)', 'journal_tag_stats()', 'journal_rename_tag(text,text)',
    'journal_delete_tag(text)', 'journal_daily_stats(date,date)', 'journal_on_this_day(date)',
    'journal_neighbors(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
