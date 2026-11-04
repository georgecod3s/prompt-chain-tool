-- =====================================================================
-- Prompt chain tool: step reordering + linking captions to the run that
-- produced them. Requires admin.sql and admin_v2.sql (from caption-clash-admin).
-- Paste into Supabase -> SQL Editor -> Run. Safe to re-run.
-- =====================================================================

-- 1. Make (chain_id, step_order) unique but DEFERRABLE, so steps can swap
--    positions inside one transaction without tripping the constraint.
do $$
declare c text;
begin
    select conname into c from pg_constraint
    where conrelid = 'public.prompt_chain_steps'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%(chain_id, step_order)%';
    if c is not null then
        execute format('alter table public.prompt_chain_steps drop constraint %I', c);
    end if;
end $$;
alter table public.prompt_chain_steps
    add constraint prompt_chain_steps_order_unique unique (chain_id, step_order) deferrable initially deferred;

-- 2. Move a step to a new position (1-based); the others shift to make room.
--    SECURITY INVOKER: row level security still applies, so only superadmins can use it.
create or replace function public.move_prompt_chain_step(p_step_id bigint, p_new_order integer)
returns void language plpgsql security invoker set search_path = public as $$
declare
    v_chain bigint;
    v_old   integer;
    v_max   integer;
    v_new   integer;
begin
    select chain_id, step_order into v_chain, v_old from prompt_chain_steps where id = p_step_id;
    if v_chain is null then raise exception 'Step % not found', p_step_id; end if;
    select count(*) into v_max from prompt_chain_steps where chain_id = v_chain;
    v_new := greatest(1, least(p_new_order, v_max));
    if v_new = v_old then return; end if;

    if v_new < v_old then
        update prompt_chain_steps set step_order = step_order + 1
        where chain_id = v_chain and step_order >= v_new and step_order < v_old;
    else
        update prompt_chain_steps set step_order = step_order - 1
        where chain_id = v_chain and step_order > v_old and step_order <= v_new;
    end if;
    update prompt_chain_steps set step_order = v_new where id = p_step_id;
end;
$$;

-- 3. Close gaps after a delete: renumber 1..n keeping the current order.
create or replace function public.renumber_prompt_chain_steps(p_chain_id bigint)
returns void language sql security invoker set search_path = public as $$
    update prompt_chain_steps s set step_order = r.rn
    from (select id, row_number() over (order by step_order, id) as rn
          from prompt_chain_steps where chain_id = p_chain_id) r
    where s.id = r.id and s.step_order <> r.rn;
$$;

grant execute on function public.move_prompt_chain_step(bigint, integer) to authenticated;
grant execute on function public.renumber_prompt_chain_steps(bigint) to authenticated;

-- 4. Remember which chain run produced each caption ------------------------
alter table public.captions
    add column if not exists generation_request_id bigint references public.generation_requests(id) on delete set null;
create index if not exists captions_generation_request_idx on public.captions(generation_request_id);

select 'ok' as status;
