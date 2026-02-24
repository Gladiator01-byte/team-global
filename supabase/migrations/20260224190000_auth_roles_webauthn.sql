create type public.user_role as enum ('employee', 'leader', 'admin', 'delegate');

alter table public.users
  add column if not exists role public.user_role not null default 'employee';

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role public.user_role not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.webauthn_challenges (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  challenge text not null,
  type text not null check (type in ('registration', 'authentication')),
  created_at timestamptz not null default now()
);

create table if not exists public.webauthn_credentials (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  credential_id text not null unique,
  credential_public_key text not null,
  counter bigint not null,
  credential_device_type text not null,
  credential_backed_up boolean not null,
  transports text[] not null default '{}',
  aaguid uuid,
  user_verified boolean not null default false,
  biometric_capable boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.qr_nonces (
  id uuid primary key default gen_random_uuid(),
  minted_by uuid not null references public.users(id) on delete cascade,
  nonce text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
