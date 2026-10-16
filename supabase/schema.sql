-- ============================================================================
-- hearme — Skema Supabase untuk MVP peer support (sesuai implementasi_mvp_peer_support.md)
-- Jalankan di Supabase Dashboard -> SQL Editor (satu kali, aman diulang).
--
-- Catatan privasi (dokumen §10-11):
--  * Tidak menyimpan transkrip penuh. Yang disimpan: ringkasan kebutuhan hasil AI
--    yang SUDAH dikonfirmasi pengguna (support_requests.needs_summary).
--  * Pesan grup/sesi tidak dipersistensi ke DB (hanya realtime, ephemeral).
-- ============================================================================

-- ---------- Enum status (dokumen §9) ----------
do $$ begin
  create type app_role as enum ('user','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_mode as enum ('group','one_to_one');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_support_category as enum ('didengarkan','berbagi_pengalaman','strategi_praktis','bantuan_profesional');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_language as enum ('id','en');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_application_status as enum ('pending','approved','rejected','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_presence_status as enum ('available','busy','offline','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_queue_status as enum ('waiting','matched','cancelled','expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_session_status as enum ('scheduled','active','completed','ended_early','reported');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_session_phase as enum ('opening','sharing','closing','ended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_participant_role as enum ('member','volunteer','facilitator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_report_status as enum ('open','reviewed','actioned','dismissed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_report_reason as enum ('pelecehan','intimidasi','eksploitasi','meminta_uang','memaksa_bercerita','menyebar_cerita','mengaku_profesional','lainnya');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_checkin_mood as enum ('lebih_baik','sama','lebih_berat');
exception when duplicate_object then null; end $$;

-- ---------- Tabel (dokumen §10) ----------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Pengguna',
  email text,
  role app_role not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists public.volunteer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status app_application_status not null default 'pending',
  motivation text,
  training_completed boolean not null default false,
  code_of_conduct_accepted_at timestamptz,
  -- Satu bukti kualifikasi: jenis + jalur objek di bucket privat 'volunteer-proofs'.
  proof_type text,
  proof_path text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists volunteer_applications_user_idx on public.volunteer_applications(user_id);

-- Kolom bukti untuk database yang tabelnya sudah terlanjur dibuat.
alter table public.volunteer_applications add column if not exists proof_type text;
alter table public.volunteer_applications add column if not exists proof_path text;

create table if not exists public.volunteer_presence (
  volunteer_id uuid primary key references public.users(id) on delete cascade,
  status app_presence_status not null default 'offline',
  last_seen_at timestamptz not null default now()
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  mode app_mode not null,
  support_category app_support_category not null,
  language app_language not null default 'id',
  needs_summary text not null default '',
  status app_queue_status not null default 'waiting',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  session_id uuid
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  mode app_mode not null,
  status app_session_status not null default 'scheduled',
  phase app_session_phase not null default 'opening',
  phase_started_at timestamptz not null default now(),
  support_category app_support_category,
  language app_language not null default 'id',
  needs_summary text,
  facilitator_id uuid references public.users(id),
  volunteer_joined boolean not null default false,
  volunteer_consent_approved boolean not null default false,
  guidance_version text not null default 'v1',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.support_requests
  drop constraint if exists support_requests_session_id_fkey;
alter table public.support_requests
  add constraint support_requests_session_id_fkey foreign key (session_id) references public.sessions(id) on delete set null;

create table if not exists public.session_participants (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  participant_role app_participant_role not null default 'member',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  consent_to_joined_volunteer_at timestamptz,
  primary key (session_id, user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  reported_user_id uuid references public.users(id) on delete set null,
  reason_category app_report_reason not null default 'lainnya',
  note text,
  status app_report_status not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz
);

-- Blokir (dokumen §11): pengguna tidak dipertemukan lagi dengan orang yang diblokir.
create table if not exists public.blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists public.session_checkins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  mood app_checkin_mood not null,
  note text,
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- Konfigurasi awal (nilai §4/§5/§8 — "configurable, bukan aturan universal") ----------
insert into public.app_config (key, value) values
  ('group_target_members', '3'),
  ('group_max_members', '5'),
  ('group_wait_minutes', '5'),
  ('one_to_one_wait_minutes', '3'),
  ('one_to_one_ring_seconds', '30'),
  ('volunteer_join_consent_seconds', '30'),
  ('session_durations', '{"opening": 5, "sharing": 25, "closing": 10}')
on conflict (key) do nothing;

-- ---------- Helper: admin? (SECURITY DEFINER menghindari rekursi RLS) ----------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
$$;

-- Helper: peserta sesi? (SECURITY DEFINER — memutus rekursi policy sessions <-> session_participants)
create or replace function public.is_session_participant(p_session_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.session_participants sp
    where sp.session_id = p_session_id and sp.user_id = auth.uid()
  );
$$;

-- ---------- Trigger: akun auth baru -> profil users ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, display_name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), 'Pengguna'),
    new.email,
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Trigger: cegah eskalasi peran (user biasa tidak boleh mengubah kolom role) ----------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- auth.uid() null = konteks server (service role / seed / SQL editor) -> izinkan
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Hanya admin yang dapat mengubah peran pengguna.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists users_prevent_role_escalation on public.users;
create trigger users_prevent_role_escalation
  before update on public.users
  for each row execute function public.prevent_role_escalation();

-- ---------- Trigger: calon relawan tidak boleh menumpuk ----------
create or replace function public.enforce_single_application()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.volunteer_applications a
    where a.user_id = new.user_id
      and a.id is distinct from new.id
      and a.status in ('pending','approved')
  ) then
    raise exception 'Anda sudah punya pendaftaran relawan yang aktif.';
  end if;
  return new;
end;
$$;

drop trigger if exists volunteer_applications_single on public.volunteer_applications;
create trigger volunteer_applications_single
  before insert on public.volunteer_applications
  for each row execute function public.enforce_single_application();

-- ============================================================================
-- RPC MATCHMAKING (dokumen §8) — semua perubahan status ditentukan backend.
-- ============================================================================

-- Buat permintaan dukungan (antrean) dari hasil ringkasan yang dikonfirmasi user.
create or replace function public.create_support_request(
  p_mode app_mode,
  p_category app_support_category,
  p_language app_language,
  p_summary text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_wait_minutes int;
  v_req public.support_requests%rowtype;
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  -- batalkan antrean lama yang masih menunggu (satu antrean aktif per user)
  update public.support_requests
     set status = 'cancelled'
   where user_id = v_user and status = 'waiting';

  select coalesce((value)::text::int, 5) into v_wait_minutes
    from public.app_config where key = case when p_mode = 'group' then 'group_wait_minutes' else 'one_to_one_wait_minutes' end;

  insert into public.support_requests (user_id, mode, support_category, language, needs_summary, status, expires_at)
  values (v_user, p_mode, p_category, p_language, coalesce(p_summary,''), 'waiting', now() + make_interval(mins => coalesce(v_wait_minutes, 5)))
  returning * into v_req;

  return to_jsonb(v_req);
end;
$$;

-- Antrean grup: user menunggu, backend mencoba membentuk grup saat kuota tercapai.
create or replace function public.poll_group_queue()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_target int;
  v_req public.support_requests%rowtype;
  v_session_id uuid;
  v_count int;
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  select coalesce((value)::text::int, 3) into v_target from public.app_config where key = 'group_target_members';
  v_target := coalesce(v_target, 3);

  -- cari permintaan waiting milik user
  select * into v_req
    from public.support_requests
   where user_id = v_user and mode = 'group' and status = 'waiting'
   order by created_at desc limit 1;

  if not found then
    return jsonb_build_object('status', 'none');
  end if;

  -- sudah expired?
  if v_req.expires_at < now() then
    update public.support_requests set status = 'expired' where id = v_req.id;
    return jsonb_build_object('status', 'expired', 'request', to_jsonb(v_req));
  end if;

  -- apakah user sudah masuk sesi aktif?
  select sp.session_id into v_session_id
    from public.session_participants sp
    join public.sessions s on s.id = sp.session_id
   where sp.user_id = v_user and s.status in ('scheduled','active')
   order by sp.joined_at desc limit 1;

  if v_session_id is not null then
    update public.support_requests set status = 'matched', session_id = v_session_id where id = v_req.id;
    return jsonb_build_object('status', 'matched', 'session_id', v_session_id);
  end if;

  -- cukup anggota untuk membentuk grup? (kategori + bahasa sama)
  select count(*) into v_count
    from public.support_requests r
   where r.mode = 'group' and r.status = 'waiting'
     and r.support_category = v_req.support_category
     and r.language = v_req.language
     and r.expires_at > now();

  if v_count >= v_target then
    insert into public.sessions (mode, status, phase, support_category, language, needs_summary)
    values ('group', 'active', 'opening', v_req.support_category, v_req.language, v_req.needs_summary)
    returning id into v_session_id;

    insert into public.session_participants (session_id, user_id, participant_role)
    select v_session_id, r.user_id, 'member'
      from public.support_requests r
     where r.mode = 'group' and r.status = 'waiting'
       and r.support_category = v_req.support_category
       and r.language = v_req.language
       and r.expires_at > now()
       and not exists (
         select 1 from public.blocks b
         where (b.blocker_id = v_req.user_id and b.blocked_id = r.user_id)
            or (b.blocker_id = r.user_id and b.blocked_id = v_req.user_id)
       )
     order by r.created_at
     limit v_target;

    update public.support_requests
       set status = 'matched', session_id = v_session_id
     where mode = 'group' and status = 'waiting'
       and support_category = v_req.support_category
       and language = v_req.language
       and expires_at > now()
       and user_id in (select user_id from public.session_participants where session_id = v_session_id);

    update public.sessions set started_at = now() where id = v_session_id and started_at is null;
    return jsonb_build_object('status', 'matched', 'session_id', v_session_id);
  end if;

  return jsonb_build_object('status', 'waiting', 'position', v_count, 'target', v_target, 'expires_at', v_req.expires_at);
end;
$$;

-- Antrean 1-on-1: reservasi relawan approved+available, timeout ring 30 detik.
create or replace function public.poll_one_to_one_queue()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_req public.support_requests%rowtype;
  v_volunteer uuid;
  v_session_id uuid;
  v_ring int;
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  select * into v_req
    from public.support_requests
   where user_id = v_user and mode = 'one_to_one' and status = 'waiting'
   order by created_at desc limit 1;

  if not found then
    return jsonb_build_object('status', 'none');
  end if;

  -- sudah ada sesi aktif 1-on-1?
  select sp.session_id into v_session_id
    from public.session_participants sp
    join public.sessions s on s.id = sp.session_id
   where sp.user_id = v_user and s.mode = 'one_to_one' and s.status in ('scheduled','active')
   order by sp.joined_at desc limit 1;

  if v_session_id is not null then
    update public.support_requests set status = 'matched', session_id = v_session_id where id = v_req.id;
    return jsonb_build_object('status', 'matched', 'session_id', v_session_id);
  end if;

  -- cari relawan approved + available + bahasa cocok (via presence)
  select p.volunteer_id into v_volunteer
    from public.volunteer_presence p
    join public.volunteer_applications a on a.user_id = p.volunteer_id and a.status = 'approved'
   where p.status = 'available'
     and p.last_seen_at > now() - interval '2 minutes'
     and not exists (
       select 1 from public.session_participants sp
       join public.sessions s on s.id = sp.session_id
       where sp.user_id = p.volunteer_id and s.status in ('scheduled','active')
     )
     and not exists (
       select 1 from public.blocks b
       where (b.blocker_id = v_req.user_id and b.blocked_id = p.volunteer_id)
          or (b.blocker_id = p.volunteer_id and b.blocked_id = v_req.user_id)
     )
   order by p.last_seen_at desc
   limit 1;

  if v_volunteer is null then
    if v_req.expires_at < now() then
      update public.support_requests set status = 'expired' where id = v_req.id;
      return jsonb_build_object('status', 'expired', 'request', to_jsonb(v_req));
    end if;
    return jsonb_build_object('status', 'waiting', 'expires_at', v_req.expires_at);
  end if;

  -- reservasi: buat sesi + participant (volunteer belum dianggap gabung sampai accept)
  insert into public.sessions (mode, status, phase, support_category, language, needs_summary, facilitator_id, started_at)
  values ('one_to_one', 'active', 'opening', v_req.support_category, v_req.language, v_req.needs_summary, v_volunteer, now())
  returning id into v_session_id;

  insert into public.session_participants (session_id, user_id, participant_role)
  values (v_session_id, v_user, 'member'), (v_session_id, v_volunteer, 'volunteer');

  update public.support_requests set status = 'matched', session_id = v_session_id where id = v_req.id;
  update public.volunteer_presence set status = 'busy', last_seen_at = now() where volunteer_id = v_volunteer;

  select coalesce((value)::text::int, 30) into v_ring from public.app_config where key = 'one_to_one_ring_seconds';

  return jsonb_build_object('status', 'matched', 'session_id', v_session_id, 'ring_seconds', coalesce(v_ring, 30));
end;
$$;

-- Relawan membalas tawaran: accept -> lanjut; decline -> user kembali menunggu (relawan dilepas).
create or replace function public.respond_to_session(p_session_id uuid, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_volunteer uuid;
  v_mode app_mode;
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  select s.mode, s.facilitator_id into v_mode, v_volunteer from public.sessions s where s.id = p_session_id;
  if v_mode is null then raise exception 'Sesi tidak ditemukan.'; end if;
  if v_mode <> 'one_to_one' then raise exception 'Hanya untuk sesi 1-on-1.'; end if;
  if v_user <> v_volunteer then raise exception 'Hanya relawan yang diundang.'; end if;

  if p_accept then
    if exists (select 1 from public.sessions where id = p_session_id and status not in ('scheduled','active')) then
      raise exception 'Sesi sudah tidak aktif.';
    end if;
    update public.volunteer_presence set status = 'busy', last_seen_at = now() where volunteer_id = v_user;
    update public.session_participants set consent_to_joined_volunteer_at = now()
     where session_id = p_session_id and user_id = v_user;
    return jsonb_build_object('ok', true, 'accepted', true);
  else
    -- lepas relawan: hapus participant relawan, sesi dibatalkan, antrean user kembali waiting
    delete from public.session_participants where session_id = p_session_id and user_id = v_user;
    update public.sessions set status = 'ended_early', ended_at = now(), phase = 'ended' where id = p_session_id;
    update public.support_requests set status = 'waiting', session_id = null
      where session_id = p_session_id and status = 'matched';
    update public.volunteer_presence set status = 'available', last_seen_at = now() where volunteer_id = v_user;
    return jsonb_build_object('ok', true, 'accepted', false);
  end if;
end;
$$;

-- Grup berjalan: relawan datang -> butuh persetujuan peserta (dokumen §4).
create or replace function public.request_volunteer_join(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_status app_session_status;
  v_app app_application_status;
  v_consent int;
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  select s.status into v_status from public.sessions s where s.id = p_session_id;
  if v_status is null then raise exception 'Sesi tidak ditemukan.'; end if;
  if v_status <> 'active' then raise exception 'Sesi tidak aktif.'; end if;

  select a.status into v_app from public.volunteer_applications a where a.user_id = v_user order by a.created_at desc limit 1;
  if v_app is distinct from 'approved' then raise exception 'Relawan belum disetujui admin.'; end if;

  if exists (select 1 from public.session_participants where session_id = p_session_id and user_id = v_user) then
    raise exception 'Anda sudah menjadi peserta sesi ini.';
  end if;

  update public.sessions
     set facilitator_id = v_user,
         volunteer_joined = true,
         volunteer_consent_approved = false,
         phase_started_at = now()
   where id = p_session_id;

  select coalesce((value)::text::int, 30) into v_consent from public.app_config where key = 'volunteer_join_consent_seconds';

  return jsonb_build_object('ok', true, 'consent_seconds', coalesce(v_consent, 30));
end;
$$;

-- Peserta menyetujui relawan bergabung (ubah jadi terapi grup); semua peserta aktif harus setuju.
create or replace function public.approve_volunteer_join(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_facilitator uuid;
  v_joined boolean;
  v_pending int;
  v_all int;
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  select facilitator_id, volunteer_joined into v_facilitator, v_joined from public.sessions where id = p_session_id;
  if v_facilitator is null or not coalesce(v_joined, false) then
    raise exception 'Tidak ada permintaan relawan bergabung.';
  end if;

  update public.session_participants
     set consent_to_joined_volunteer_at = now()
   where session_id = p_session_id and user_id = v_user and participant_role = 'member';

  select count(*) filter (where consent_to_joined_volunteer_at is null),
         count(*)
    into v_pending, v_all
    from public.session_participants
   where session_id = p_session_id and participant_role = 'member' and left_at is null;

  if v_pending = 0 then
    insert into public.session_participants (session_id, user_id, participant_role, consent_to_joined_volunteer_at)
    values (p_session_id, v_facilitator, 'facilitator', now())
    on conflict (session_id, user_id) do update
      set left_at = null,
          participant_role = 'facilitator',
          consent_to_joined_volunteer_at = now();

    update public.sessions set volunteer_consent_approved = true where id = p_session_id;
    update public.volunteer_presence set status = 'busy', last_seen_at = now() where volunteer_id = v_facilitator;
    return jsonb_build_object('ok', true, 'approved', true);
  end if;

  return jsonb_build_object('ok', true, 'approved', false, 'pending', v_pending, 'total', v_all);
end;
$$;

-- Peserta menolak relawan bergabung -> sesi tetap grup peer support.
create or replace function public.decline_volunteer_join(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  if not exists (
    select 1 from public.session_participants
    where session_id = p_session_id and user_id = v_user and participant_role = 'member'
  ) then
    raise exception 'Hanya peserta yang dapat memilih.';
  end if;

  update public.sessions
     set volunteer_joined = false,
         volunteer_consent_approved = false,
         facilitator_id = null,
         phase_started_at = now()
   where id = p_session_id;

  return jsonb_build_object('ok', true, 'approved', false);
end;
$$;

-- Perubahan fase panduan sesi (dokumen §4).
create or replace function public.set_session_phase(p_session_id uuid, p_phase app_session_phase)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  if not exists (
    select 1 from public.session_participants
    where session_id = p_session_id and user_id = v_user and left_at is null
  ) then
    raise exception 'Hanya peserta aktif yang dapat mengubah fase.';
  end if;

  update public.sessions set phase = p_phase, phase_started_at = now() where id = p_session_id and status = 'active';
  return jsonb_build_object('ok', true, 'phase', p_phase);
end;
$$;

-- Akhiri sesi (oleh peserta atau relawan).
create or replace function public.end_session(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_facilitator uuid;
  v_mode app_mode;
  v_volunteer uuid;
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  select mode, facilitator_id into v_mode, v_facilitator from public.sessions where id = p_session_id;
  if v_mode is null then raise exception 'Sesi tidak ditemukan.'; end if;

  if not exists (
    select 1 from public.session_participants
    where session_id = p_session_id and user_id = v_user and left_at is null
  ) then
    raise exception 'Hanya peserta aktif yang dapat mengakhiri sesi.';
  end if;

  update public.sessions
     set status = 'completed', phase = 'ended', ended_at = now()
   where id = p_session_id;

  update public.session_participants set left_at = coalesce(left_at, now()) where session_id = p_session_id;

  -- relawan kembali available HANYA jika dia memilih status itu
  select user_id into v_volunteer
    from public.session_participants
   where session_id = p_session_id and participant_role in ('volunteer','facilitator')
   limit 1;

  if v_volunteer is not null then
    update public.volunteer_presence
       set last_seen_at = now(),
           status = case when status = 'busy' then 'offline' else status end
     where volunteer_id = v_volunteer;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Keluar dari sesi tanpa mengakhiri sesi orang lain.
create or replace function public.leave_session(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_mode app_mode;
  v_facilitator uuid;
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  select mode, facilitator_id into v_mode, v_facilitator from public.sessions where id = p_session_id;

  update public.session_participants set left_at = now() where session_id = p_session_id and user_id = v_user;

  if v_mode = 'one_to_one' then
    -- keluar dari 1-on-1 = sesi berakhir
    update public.sessions set status = 'ended_early', phase = 'ended', ended_at = now()
     where id = p_session_id and status in ('scheduled','active');
    if v_facilitator is not null then
      update public.volunteer_presence set status = 'offline', last_seen_at = now() where volunteer_id = v_facilitator;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Check-in setelah sesi (opsional, dokumen §4/§5).
create or replace function public.submit_checkin(p_session_id uuid, p_mood app_checkin_mood, p_note text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  insert into public.session_checkins (session_id, user_id, mood, note)
  values (p_session_id, v_user, p_mood, nullif(p_note, ''))
  on conflict (session_id, user_id) do update set mood = excluded.mood, note = excluded.note, created_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- Lepas reservasi basi: relawan yang diundang tapi tidak merespons dalam ring_seconds.
-- Dipanggil klien mana pun saat membuka halaman antrean/sesi (idempoten).
create or replace function public.release_stale_reservations()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ring int;
  v_stale record;
  v_released int := 0;
begin
  if auth.uid() is null then raise exception 'Harus login.'; end if;

  select coalesce((value)::text::int, 30) into v_ring from public.app_config where key = 'one_to_one_ring_seconds';
  v_ring := coalesce(v_ring, 30);

  for v_stale in
    select s.id, s.facilitator_id
      from public.sessions s
     where s.mode = 'one_to_one'
       and s.status = 'active'
       and s.facilitator_id is not null
       and not exists (
         select 1 from public.session_participants sp
         where sp.session_id = s.id and sp.user_id = s.facilitator_id and sp.consent_to_joined_volunteer_at is not null
       )
       and s.started_at < now() - make_interval(secs => v_ring)
  loop
    delete from public.session_participants where session_id = v_stale.id and user_id = v_stale.facilitator_id;
    update public.sessions set status = 'ended_early', phase = 'ended', ended_at = now() where id = v_stale.id;
    update public.support_requests set status = 'waiting', session_id = null
      where session_id = v_stale.id and status = 'matched';
    update public.volunteer_presence set status = 'offline', last_seen_at = now() where volunteer_id = v_stale.facilitator_id;
    v_released := v_released + 1;
  end loop;

  return jsonb_build_object('released', v_released);
end;
$$;

-- Batal antrean sendiri (dokumen §4/§5: tombol keluar).
create or replace function public.cancel_support_request(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  update public.support_requests
     set status = 'cancelled'
   where id = p_request_id and user_id = v_user and status = 'waiting';

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================================
-- LOBBY RELAWAN (alur baru: "muncul matchmaking dari user" -> "Buat Manggil")
-- ============================================================================

-- Feed lobby: permintaan yang sedang menunggu, TANPA identitas/ringkasan pengguna.
-- Hanya relawan approved yang dapat melihat (dipakai halaman /app/lobby).
create or replace function public.lobby_waiting_requests()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_rows jsonb;
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  if not exists (
    select 1 from public.volunteer_applications a
    where a.user_id = v_user and a.status = 'approved'
  ) then
    raise exception 'Hanya relawan approved yang dapat membuka lobby.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'mode', r.mode,
           'support_category', r.support_category,
           'language', r.language,
           'created_at', r.created_at
         ) order by r.created_at), '[]'::jsonb)
    into v_rows
    from public.support_requests r
   where r.status = 'waiting'
     and r.expires_at > now()
     and not exists (
       select 1 from public.blocks b
       where (b.blocker_id = r.user_id and b.blocked_id = v_user)
          or (b.blocker_id = v_user and b.blocked_id = r.user_id)
     );

  return v_rows;
end;
$$;

-- "Buat Manggil": relawan di lobby memanggil permintaan 1-on-1 yang menunggu.
-- Relawan approved + available -> sesi 1-on-1 langsung dibuat (relawan sudah
-- dianggap menerima). Peserta tetap harus mengonfirmasi sebelum sesi dimulai.
create or replace function public.volunteer_claim_request(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_req public.support_requests%rowtype;
  v_session_id uuid;
  v_presence app_presence_status;
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  if not exists (
    select 1 from public.volunteer_applications a
    where a.user_id = v_user and a.status = 'approved'
  ) then
    raise exception 'Hanya relawan approved yang dapat memanggil.';
  end if;

  select status into v_presence from public.volunteer_presence where volunteer_id = v_user;
  if v_presence is distinct from 'available' then
    raise exception 'Set status “Siap menerima sesi” dulu.';
  end if;

  if exists (
    select 1 from public.session_participants sp
    join public.sessions s on s.id = sp.session_id
    where sp.user_id = v_user and s.status in ('scheduled','active')
  ) then
    raise exception 'Kamu sedang menangani sesi lain.';
  end if;

  select * into v_req
    from public.support_requests
   where id = p_request_id and status = 'waiting' and mode = 'one_to_one'
   for update;

  if not found then
    raise exception 'Permintaan ini sudah tidak menunggu.';
  end if;

  if v_req.expires_at < now() then
    update public.support_requests set status = 'expired' where id = v_req.id;
    raise exception 'Permintaan sudah kedaluwarsa.';
  end if;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = v_req.user_id and b.blocked_id = v_user)
       or (b.blocker_id = v_user and b.blocked_id = v_req.user_id)
  ) then
    raise exception 'Tidak dapat memanggil permintaan ini.';
  end if;

  insert into public.sessions (mode, status, phase, support_category, language, needs_summary, facilitator_id, started_at)
  values ('one_to_one', 'active', 'opening', v_req.support_category, v_req.language, v_req.needs_summary, v_user, now())
  returning id into v_session_id;

  insert into public.session_participants (session_id, user_id, participant_role, consent_to_joined_volunteer_at)
  values (v_session_id, v_req.user_id, 'member', null),
         (v_session_id, v_user, 'volunteer', now());

  update public.support_requests set status = 'matched', session_id = v_session_id where id = v_req.id;
  update public.volunteer_presence set status = 'busy', last_seen_at = now() where volunteer_id = v_user;

  return jsonb_build_object('ok', true, 'session_id', v_session_id);
end;
$$;

-- Peserta 1-on-1 mengonfirmasi sebelum sesi dimulai (dokumen §5: tampilkan
-- konfirmasi sebelum sesi berjalan). Hanya berlaku setelah relawan menerima.
create or replace function public.confirm_member_consent(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_mode app_mode;
  v_volunteer_consent timestamptz;
begin
  if v_user is null then raise exception 'Harus login.'; end if;

  select mode into v_mode from public.sessions where id = p_session_id;
  if v_mode is null then raise exception 'Sesi tidak ditemukan.'; end if;
  if v_mode <> 'one_to_one' then raise exception 'Hanya untuk sesi 1-on-1.'; end if;

  if not exists (
    select 1 from public.session_participants
    where session_id = p_session_id and user_id = v_user and participant_role = 'member'
  ) then
    raise exception 'Hanya peserta yang dapat mengonfirmasi.';
  end if;

  select consent_to_joined_volunteer_at into v_volunteer_consent
    from public.session_participants
   where session_id = p_session_id and participant_role in ('volunteer','facilitator')
   limit 1;

  if v_volunteer_consent is null then
    raise exception 'Relawan belum menerima panggilan.';
  end if;

  update public.session_participants
     set consent_to_joined_volunteer_at = now()
   where session_id = p_session_id and user_id = v_user;

  return jsonb_build_object('ok', true);
end;
$$;

-- Statistik agregat untuk admin (dokumen §7 — tanpa isi percakapan).
create or replace function public.admin_stats()
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Hanya admin.'; end if;

  return jsonb_build_object(
    'applications_pending', (select count(*) from public.volunteer_applications where status = 'pending'),
    'applications_approved', (select count(*) from public.volunteer_applications where status = 'approved'),
    'volunteers_available', (select count(*) from public.volunteer_presence where status = 'available'),
    'sessions_total', (select count(*) from public.sessions),
    'sessions_active', (select count(*) from public.sessions where status = 'active'),
    'sessions_group', (select count(*) from public.sessions where mode = 'group'),
    'sessions_one_to_one', (select count(*) from public.sessions where mode = 'one_to_one'),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'checkins_total', (select count(*) from public.session_checkins),
    'checkins_lebih_baik', (select count(*) from public.session_checkins where mood = 'lebih_baik')
  );
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (dokumen §7/§11: admin tidak akses default ke percakapan)
-- ============================================================================
alter table public.users enable row level security;
alter table public.volunteer_applications enable row level security;
alter table public.volunteer_presence enable row level security;
alter table public.support_requests enable row level security;
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.reports enable row level security;
alter table public.session_checkins enable row level security;
alter table public.app_config enable row level security;
alter table public.blocks enable row level security;

-- users
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users for select using (id = auth.uid() or public.is_admin());
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users for update using (id = auth.uid()) with check (id = auth.uid());

-- volunteer_applications
drop policy if exists va_select on public.volunteer_applications;
create policy va_select on public.volunteer_applications for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists va_insert on public.volunteer_applications;
create policy va_insert on public.volunteer_applications for insert
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists va_update_admin on public.volunteer_applications;
create policy va_update_admin on public.volunteer_applications for update
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- BUKTI KUALIFIKASI RELAWAN (Storage)
-- Relawan mengunggah SATU bukti saat mendaftar (STR / ijazah psikologi /
-- sertifikat / surat keterangan kampus). Bucket privat: hanya pemilik folder
-- (id user) dan admin yang bisa membacanya; admin membuka lewat signed URL.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('volunteer-proofs', 'volunteer-proofs', false)
on conflict (id) do nothing;

drop policy if exists vp_insert_own on storage.objects;
create policy vp_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'volunteer-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists vp_select_own_or_admin on storage.objects;
create policy vp_select_own_or_admin on storage.objects for select to authenticated
  using (
    bucket_id = 'volunteer-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists vp_update_own on storage.objects;
create policy vp_update_own on storage.objects for update to authenticated
  using (
    bucket_id = 'volunteer-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- volunteer_presence (approval dicek di trigger)
create or replace function public.enforce_volunteer_presence()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.volunteer_applications a
    where a.user_id = new.volunteer_id and a.status = 'approved'
  ) then
    raise exception 'Hanya relawan approved yang dapat mengatur status.';
  end if;
  return new;
end;
$$;

drop trigger if exists volunteer_presence_approved on public.volunteer_presence;
create trigger volunteer_presence_approved
  before insert or update on public.volunteer_presence
  for each row execute function public.enforce_volunteer_presence();

drop policy if exists vp_select on public.volunteer_presence;
create policy vp_select on public.volunteer_presence for select using (true);
drop policy if exists vp_write on public.volunteer_presence;
create policy vp_write on public.volunteer_presence for all
  using (volunteer_id = auth.uid()) with check (volunteer_id = auth.uid());

-- support_requests
drop policy if exists sr_select on public.support_requests;
create policy sr_select on public.support_requests for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists sr_insert on public.support_requests;
create policy sr_insert on public.support_requests for insert
  with check (user_id = auth.uid());
drop policy if exists sr_update on public.support_requests;
create policy sr_update on public.support_requests for update
  using (user_id = auth.uid() or public.is_admin());

-- sessions
drop policy if exists s_select on public.sessions;
create policy s_select on public.sessions for select
  using (
    public.is_admin()
    or public.is_session_participant(id)
  );
-- relawan approved boleh melihat sesi grup aktif untuk menawarkan bantuan (dokumen §4)
drop policy if exists s_select_volunteer on public.sessions;
create policy s_select_volunteer on public.sessions for select
  using (
    mode = 'group' and status = 'active'
    and exists (select 1 from public.volunteer_applications a where a.user_id = auth.uid() and a.status = 'approved')
  );
drop policy if exists s_update_participant on public.sessions;
create policy s_update_participant on public.sessions for update
  using (
    public.is_admin()
    or public.is_session_participant(id)
  );

-- session_participants
drop policy if exists sp_select on public.session_participants;
create policy sp_select on public.session_participants for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_session_participant(session_id)
  );
-- relawan approved boleh melihat peserta sesi grup aktif (untuk menimbang ikut mendampingi)
drop policy if exists sp_select_volunteer on public.session_participants;
create policy sp_select_volunteer on public.session_participants for select
  using (
    exists (select 1 from public.volunteer_applications a where a.user_id = auth.uid() and a.status = 'approved')
    and exists (select 1 from public.sessions s where s.id = session_id and s.mode = 'group' and s.status = 'active')
  );

-- reports: pelapor lihat miliknya, admin lihat semua; update hanya admin
drop policy if exists r_select on public.reports;
create policy r_select on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());
drop policy if exists r_insert on public.reports;
create policy r_insert on public.reports for insert
  with check (reporter_id = auth.uid());
drop policy if exists r_update_admin on public.reports;
create policy r_update_admin on public.reports for update
  using (public.is_admin()) with check (public.is_admin());

-- session_checkins: pemilik + admin
drop policy if exists sc_select on public.session_checkins;
create policy sc_select on public.session_checkins for select
  using (user_id = auth.uid() or public.is_admin());

-- app_config: dibaca semua, ubah admin
drop policy if exists ac_select on public.app_config;
create policy ac_select on public.app_config for select using (true);
drop policy if exists ac_update_admin on public.app_config;
create policy ac_update_admin on public.app_config for update
  using (public.is_admin()) with check (public.is_admin());

-- blocks: hanya pemilik yang bisa lihat/buat/hapus blokirnya
drop policy if exists b_select on public.blocks;
create policy b_select on public.blocks for select using (blocker_id = auth.uid() or public.is_admin());
drop policy if exists b_insert on public.blocks;
create policy b_insert on public.blocks for insert with check (blocker_id = auth.uid());
drop policy if exists b_delete on public.blocks;
create policy b_delete on public.blocks for delete using (blocker_id = auth.uid());

-- ============================================================================
-- REALTIME — hanya untuk sinyal (broadcast & postgres_changes pada tabel sinyal).
-- Pesan chat TIDAK dipersistensi; dikirim via Realtime Broadcast (ephemeral).
-- ============================================================================
do $$ begin
  alter publication supabase_realtime add table public.sessions;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.session_participants;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.volunteer_presence;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.reports;
exception when others then null; end $$;

-- ============================================================================
-- Catatan operasional:
--  1) Relawan "approved": update manual via SQL Editor (demo) atau panel admin.
--     Hanya butuh 2 user auth (user@demo.local, relawan@demo.local, admin@demo.local).
--  2) Untuk demo cepat, admin dapat mengubah app_config (mis. group_target_members=2).
--  3) Jalankan scripts/seed.mjs setelah membuat 3 user demo.
-- ============================================================================
