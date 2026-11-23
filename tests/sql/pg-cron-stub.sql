-- A stand-in for Supabase's pg_cron, for the THROWAWAY test database only (local Postgres has no pg_cron). Same names and
-- signatures the 23 Nov block uses: cron.job, cron.job_run_details, cron.schedule(name, schedule, command) (a second call with
-- the same name replaces that job, like pg_cron 1.3+), cron.unschedule(jobid) and cron.unschedule(name) — both raise an error
-- when the job does not exist, like the real ones (which is why the block unschedules through "from cron.job where jobname").
-- Jobs never run on their own here: the test runs the stored command itself, as one string, the way pg_cron does.
create schema if not exists cron;
create table if not exists cron.job(jobid bigserial primary key, schedule text not null, command text not null,
  nodename text not null default 'localhost', nodeport int not null default 5432, database text not null default current_database(),
  username text not null default current_user, active boolean not null default true, jobname text unique);
create table if not exists cron.job_run_details(jobid bigint, runid bigserial primary key, job_pid int, database text, username text,
  command text, status text, return_message text, start_time timestamptz, end_time timestamptz);
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql as $$
declare id bigint;
begin
 insert into cron.job(jobname, schedule, command) values(job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command, active = true
  returning jobid into id;
 return id;
end $$;
create or replace function cron.unschedule(job_id bigint) returns boolean language plpgsql as $$
begin
 delete from cron.job where jobid = job_id;
 if not found then raise exception 'could not find valid entry for job %', job_id; end if;
 return true;
end $$;
create or replace function cron.unschedule(job_name text) returns boolean language plpgsql as $$
begin
 delete from cron.job where jobname = job_name;
 if not found then raise exception 'could not find valid entry for job ''%''', job_name; end if;
 return true;
end $$;
