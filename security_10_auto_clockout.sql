-- Server-side 8pm auto clock-out. Writes one 'out' at 20:00 Sydney for anyone whose
-- latest punch is an 'in' that started before 20:00 on its own day. Idempotent: a person
-- whose latest punch is already an 'out' is never touched. Looks back 36h so a missed
-- night is caught the next morning. p_dry=true lists who WOULD be clocked out, writes nothing.
create or replace function public.auto_clock_out_8pm(p_dry boolean default false)
returns table(staff_name text, clock_in_ts timestamptz, out_ts timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with latest as (
    select distinct on (c.staff_name) c.staff_name, c.action, c.ts
    from public.clock_log c
    where c.ts > now() - interval '36 hours'
    order by c.staff_name, c.ts desc
  ), due as (
    select l.staff_name, l.ts as in_ts,
           ((date_trunc('day', l.ts at time zone 'Australia/Sydney') + interval '20 hours') at time zone 'Australia/Sydney') as o_ts
    from latest l where l.action = 'in'
  ), pick as (
    select d.* from due d where d.in_ts < d.o_ts and d.o_ts <= now()
  ), ins as (
    insert into public.clock_log(staff_name, action, ts, notes, origin)
    select p.staff_name, 'out', p.o_ts, 'auto: 8pm missed clock-out (server)', 'auto'
    from pick p where not p_dry
    returning public.clock_log.staff_name
  )
  select p.staff_name, p.in_ts, p.o_ts from pick p;
end $$;
revoke all on function public.auto_clock_out_8pm(boolean) from public, anon, authenticated;
grant execute on function public.auto_clock_out_8pm(boolean) to service_role;
