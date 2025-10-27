alter table public.clock_in_records
  alter column clock_in_time type timestamptz
  using clock_in_time at time zone 'UTC';

alter table public.clock_in_records
  alter column clock_out_time type timestamptz
  using clock_out_time at time zone 'UTC';

