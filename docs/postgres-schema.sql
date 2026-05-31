-- AKRIVO Skin production schema reference.
-- The local MVP uses server/db/localStore.js, but the model boundaries map to these tables.

create table users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  name text,
  age_range text,
  country text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  consent_accepted boolean not null default false,
  privacy_version_accepted text not null
);

create table skin_profiles (
  user_id text primary key references users(id) on delete cascade,
  skin_type text not null,
  concerns jsonb not null default '[]',
  allergies jsonb not null default '[]',
  current_routine text,
  budget_level text,
  sensitivity_level text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table image_assets (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  storage_path text not null,
  file_type text not null,
  file_size integer not null,
  upload_purpose text not null,
  created_at timestamptz not null,
  deleted_at timestamptz
);

create table skin_analyses (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  image_id text references image_assets(id),
  questionnaire_data jsonb not null,
  ai_findings jsonb not null,
  confidence_scores jsonb not null,
  red_flags jsonb not null default '[]',
  routine_recommendation_id text,
  created_at timestamptz not null
);

create table routines (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  morning_steps jsonb not null,
  night_steps jsonb not null,
  cautions jsonb not null default '[]',
  generated_from_analysis_id text references skin_analyses(id),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table skin_analyses
  add constraint fk_analysis_routine foreign key (routine_recommendation_id) references routines(id);

create table routine_completions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  date date not null,
  routine_type text not null check (routine_type in ('morning', 'night')),
  steps_completed jsonb not null default '[]',
  skipped_steps jsonb not null default '[]',
  completed_at timestamptz,
  updated_at timestamptz not null,
  unique (user_id, date, routine_type)
);

create table progress_photos (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  image_id text not null references image_assets(id),
  notes text,
  concerns jsonb not null default '[]',
  created_at timestamptz not null,
  visibility text not null check (visibility in ('private', 'shared'))
);

create table duo_connections (
  id text primary key,
  user_a_id text not null references users(id) on delete cascade,
  user_b_id text references users(id) on delete set null,
  duo_code text not null unique,
  status text not null,
  share_routine_status boolean not null default true,
  share_streak boolean not null default true,
  share_progress_notes boolean not null default false,
  share_photos boolean not null default false,
  created_at timestamptz not null
);

create table settings (
  user_id text primary key references users(id) on delete cascade,
  reminders_enabled boolean not null default true,
  morning_time text not null default '08:00',
  night_time text not null default '20:00',
  step_delay_minutes integer not null default 10,
  skip_today boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
