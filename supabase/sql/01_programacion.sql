create extension if not exists pg_cron;
create extension if not exists pg_net;
create table if not exists public.buzon_scheduled_campaigns (
 id uuid primary key, subject text not null, html text not null, scheduled_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.buzon_scheduled_recipients (
 id bigint generated always as identity primary key, campaign_id uuid not null references public.buzon_scheduled_campaigns(id), email text not null, name text not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')), claimed_at timestamptz, finished_at timestamptz, error text, unique(campaign_id,email)
);
create index if not exists buzon_pending_idx on public.buzon_scheduled_recipients(campaign_id,id) where status='pending';
alter table public.buzon_scheduled_campaigns enable row level security;
alter table public.buzon_scheduled_recipients enable row level security;
revoke all on public.buzon_scheduled_campaigns,public.buzon_scheduled_recipients from anon,authenticated;
grant all on public.buzon_scheduled_campaigns,public.buzon_scheduled_recipients to service_role;
grant usage,select on sequence public.buzon_scheduled_recipients_id_seq to service_role;
create or replace function public.buzon_create_scheduled(p_id uuid,p_subject text,p_html text,p_at timestamptz,p_recipients jsonb) returns void language plpgsql set search_path='' as $$
begin
 if p_at<=now() then raise exception 'La fecha debe ser futura'; end if;
 insert into public.buzon_scheduled_campaigns(id,subject,html,scheduled_at) values(p_id,p_subject,p_html,p_at);
 insert into public.buzon_scheduled_recipients(campaign_id,email,name) select p_id,x.e,x.n from jsonb_to_recordset(p_recipients) as x(e text,n text);
end;$$;
create or replace function public.buzon_claim_scheduled() returns table(id bigint,campaign_id uuid,email text,name text,subject text,html text) language plpgsql set search_path='' as $$
begin
 update public.buzon_scheduled_recipients r set status='failed',error='Resultado no confirmado; revisar proveedor antes de reenviar',finished_at=now() where r.status='processing' and r.claimed_at<now()-interval '10 minutes';
 return query with picked as (
 select r.id from public.buzon_scheduled_recipients r join public.buzon_scheduled_campaigns c on c.id=r.campaign_id where r.status='pending' and c.scheduled_at<=now() order by c.scheduled_at,r.id limit 10 for update of r skip locked
 ), claimed as (
 update public.buzon_scheduled_recipients r set status='processing',claimed_at=now() from picked p where r.id=p.id returning r.*
 ) select r.id,r.campaign_id,r.email,r.name,c.subject,c.html from claimed r join public.buzon_scheduled_campaigns c on c.id=r.campaign_id;
end;$$;
create or replace function public.buzon_list_scheduled() returns table(id uuid,subject text,scheduled_at timestamptz,pending bigint,processing bigint,sent bigint,failed bigint,cancelled bigint) language sql set search_path='' as $$
 select c.id,c.subject,c.scheduled_at,count(*) filter(where r.status='pending'),count(*) filter(where r.status='processing'),count(*) filter(where r.status='sent'),count(*) filter(where r.status='failed'),count(*) filter(where r.status='cancelled') from public.buzon_scheduled_campaigns c left join public.buzon_scheduled_recipients r on c.id=r.campaign_id group by c.id order by c.created_at desc limit 100;
$$;
revoke all on function public.buzon_create_scheduled(uuid,text,text,timestamptz,jsonb),public.buzon_claim_scheduled(),public.buzon_list_scheduled() from public,anon,authenticated;
grant execute on function public.buzon_create_scheduled(uuid,text,text,timestamptz,jsonb),public.buzon_claim_scheduled(),public.buzon_list_scheduled() to service_role;
