create table if not exists medy_public_leads (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null check (source = 'medy_public'),
  source_page text,
  visitor_name text not null,
  company_name text,
  email text,
  phone text,
  preferred_contact_method text not null check (preferred_contact_method in ('email', 'phone', 'either')),
  service_category text not null,
  facility_type text,
  service_location text,
  requirements_summary text not null,
  desired_start text,
  consent_status boolean not null check (consent_status = true),
  consent_timestamp timestamptz not null,
  lead_status text not null default 'new',
  notification_status text not null default 'pending',
  notification_attempts integer not null default 0,
  notification_last_error text,
  constraint medy_public_leads_contact_required check (email is not null or phone is not null)
);

create index if not exists medy_public_leads_created_at_idx
  on medy_public_leads (created_at desc);

create index if not exists medy_public_leads_notification_idx
  on medy_public_leads (notification_status, created_at);
