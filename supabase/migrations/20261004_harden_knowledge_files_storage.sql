-- Already applied to the live project on 2026-10-04 (kept here so the repo matches production).

-- ROOT CAUSE of "chat history never saves": trigger update_ai_conversations_updated_at sets
-- NEW.updated_at, but ai_conversations had no such column, so every UPDATE on it errored. The
-- on_ai_message_insert trigger updates that table, so EVERY ai_messages insert rolled back.
alter table public.ai_conversations
  add column if not exists updated_at timestamptz not null default now();

-- Users may delete their own messages (needed for Regenerate).
drop policy if exists ai_messages_delete_own on public.ai_messages;
create policy ai_messages_delete_own on public.ai_messages
  for delete to authenticated using ((select auth.uid()) = user_id);

-- History sidebar: pinned first, then most recent.
create index if not exists idx_ai_conversations_user_recent
  on public.ai_conversations (user_id, is_pinned desc, last_message_at desc);

-- Keep message_count honest on delete (insert side is handled by on_ai_message_insert).
create or replace function public.update_conversation_stats_on_delete()
returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $$
begin
  update public.ai_conversations set message_count = greatest(0, message_count - 1)
   where id = old.conversation_id;
  return old;
end; $$;
drop trigger if exists on_ai_message_delete on public.ai_messages;
create trigger on_ai_message_delete after delete on public.ai_messages
  for each row execute function public.update_conversation_stats_on_delete();

-- A single INSERT of [user, assistant] gave both rows the same now(), so reload order was undefined.
alter table public.ai_messages alter column created_at set default clock_timestamp();
alter table public.ai_messages alter column model_used set default 'groq';
