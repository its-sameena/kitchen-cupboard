-- Only needed if you ran an EARLIER version of the migration in this project.
-- Removes all Kitchen Cupboard tables and functions (and their data!) so the
-- current migration can be run fresh. Run in the SQL Editor, then run the migration.
drop table if exists public.feedback, public.push_subscriptions, public.events, public.grocery,
  public.runs, public.items, public.members, public.devices, public.kitchens cascade;
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('my_kitchen','_kitchen','_check','_name','_event','_restock','_drop_grocery','_active_run',
         '_touch','create_kitchen','join_kitchen','leave_kitchen','forget_device','create_profile','delete_profile',
         'add_item','have_it_too','ran_out','update_item','add_grocery','request_entry','unrequest_entry',
         'mark_bought','start_run','toggle_got','end_run','submit_feedback','update_feedback','delete_feedback')
  loop
    execute 'drop function ' || f.sig || ' cascade';
  end loop;
end $$;
