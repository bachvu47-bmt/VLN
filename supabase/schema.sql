-- ============================================================
--  KHO TRI THỨC CHUNG CỦA MAIKA — Supabase (Postgres + pgvector)
--  Chạy lại nhiều lần được (idempotent). scripts/setup-supabase.mjs tự chạy file này.
--
--  Bảo mật: app dùng key public (anon/publishable) → anon CHỈ được ĐỌC bảng.
--  Mọi thao tác GHI đi qua hàm SECURITY DEFINER:
--   - de_xuat_sua_sai(): ai cũng gọi được, chỉ tạo đề xuất 'cho_duyet'
--   - admin_*(): bắt buộc đúng PIN Admin (lưu dạng bcrypt, anon không đọc được)
-- ============================================================
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.tri_thuc (
  id           text primary key,
  loai         text not null check (loai in ('web', 'sua_sai', 'tai_lieu')),
  trang_thai   text not null check (trang_thai in ('da_duyet', 'cho_duyet')),
  tieu_de      text not null default '',
  noi_dung     text not null default '',
  cau_hoi      text,
  tra_loi_sai  text,
  tra_loi_dung text,
  tags         jsonb not null default '[]'::jsonb,
  nguon        text,
  sp_id        text,
  hash         text,
  nguoi_tao    text,
  duyet_boi    text,
  tao_luc      timestamptz not null default now(),
  duyet_luc    timestamptz,
  cap_nhat_luc timestamptz not null default now(),
  da_xoa       boolean not null default false, -- tombstone để các máy đồng bộ việc xoá
  embedding    extensions.vector(768),
  co_vector    boolean generated always as (embedding is not null) stored
);

create index if not exists tri_thuc_cap_nhat_idx on public.tri_thuc (cap_nhat_luc);
create index if not exists tri_thuc_embedding_idx on public.tri_thuc using hnsw (embedding extensions.vector_cosine_ops);

-- Mọi thay đổi đều đẩy cap_nhat_luc → các máy kéo phần chênh lệch
create or replace function public.tri_thuc_cham_gio() returns trigger language plpgsql as $$
begin
  new.cap_nhat_luc := clock_timestamp();
  return new;
end $$;
drop trigger if exists tri_thuc_cham_gio on public.tri_thuc;
create trigger tri_thuc_cham_gio before insert or update on public.tri_thuc
  for each row execute function public.tri_thuc_cham_gio();

alter table public.tri_thuc enable row level security;
drop policy if exists tri_thuc_doc on public.tri_thuc;
create policy tri_thuc_doc on public.tri_thuc for select to anon, authenticated using (true);
revoke insert, update, delete on public.tri_thuc from anon, authenticated;

-- PIN Admin (bcrypt) — RLS bật, không policy → anon không đọc được
create table if not exists public.admin_pin (
  id       int primary key default 1 check (id = 1),
  pin_hash text not null
);
alter table public.admin_pin enable row level security;
revoke all on public.admin_pin from anon, authenticated;

create or replace function public._pin_dung(p_pin text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.admin_pin where pin_hash = extensions.crypt(p_pin, pin_hash));
$$;
revoke all on function public._pin_dung(text) from public, anon, authenticated;

create or replace function public._bat_pin(p_pin text) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public._pin_dung(p_pin) then
    raise exception 'Sai mã PIN Admin' using errcode = '28000';
  end if;
end $$;
revoke all on function public._bat_pin(text) from public, anon, authenticated;

-- ---------- API cho app ----------

create or replace function public.kiem_tra_pin(p_pin text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public._pin_dung(p_pin);
$$;

-- Nhân viên báo Maika trả lời sai → đề xuất chờ duyệt
create or replace function public.de_xuat_sua_sai(p_id text, p_cau_hoi text, p_tra_loi_sai text, p_tra_loi_dung text, p_nguoi text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(coalesce(p_tra_loi_dung, '')) = 0 or length(p_tra_loi_dung) > 4000 or length(coalesce(p_cau_hoi, '')) > 2000 then
    raise exception 'Nội dung đề xuất không hợp lệ';
  end if;
  insert into public.tri_thuc (id, loai, trang_thai, tieu_de, noi_dung, cau_hoi, tra_loi_sai, tra_loi_dung, nguoi_tao)
  values (p_id, 'sua_sai', 'cho_duyet', 'Đề xuất đính chính: ' || left(p_cau_hoi, 80),
          'Câu hỏi: ' || p_cau_hoi || E'\nTrả lời ĐÚNG: ' || p_tra_loi_dung,
          p_cau_hoi, left(p_tra_loi_sai, 4000), p_tra_loi_dung, left(p_nguoi, 100))
  on conflict (id) do nothing;
end $$;

-- Admin ghi/cập nhật tri thức đã duyệt (kèm embedding nếu có). p_rows: jsonb array
create or replace function public.admin_ghi(p_pin text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform public._bat_pin(p_pin);
  insert into public.tri_thuc as t (id, loai, trang_thai, tieu_de, noi_dung, cau_hoi, tra_loi_sai, tra_loi_dung,
                                    tags, nguon, sp_id, hash, nguoi_tao, duyet_boi, tao_luc, duyet_luc, da_xoa, embedding)
  select r->>'id', r->>'loai', coalesce(r->>'trang_thai', 'da_duyet'), coalesce(r->>'tieu_de', ''), coalesce(r->>'noi_dung', ''),
         r->>'cau_hoi', r->>'tra_loi_sai', r->>'tra_loi_dung', coalesce(r->'tags', '[]'::jsonb), r->>'nguon', r->>'sp_id',
         r->>'hash', r->>'nguoi_tao', r->>'duyet_boi', coalesce((r->>'tao_luc')::timestamptz, now()),
         (r->>'duyet_luc')::timestamptz, false,
         case when jsonb_typeof(r->'embedding') = 'array' then (r->>'embedding')::extensions.vector else null end
  from jsonb_array_elements(p_rows) r
  on conflict (id) do update set
    loai = excluded.loai, trang_thai = excluded.trang_thai, tieu_de = excluded.tieu_de, noi_dung = excluded.noi_dung,
    cau_hoi = excluded.cau_hoi, tra_loi_sai = excluded.tra_loi_sai, tra_loi_dung = excluded.tra_loi_dung,
    tags = excluded.tags, nguon = excluded.nguon, sp_id = excluded.sp_id, hash = excluded.hash,
    duyet_boi = excluded.duyet_boi, duyet_luc = excluded.duyet_luc, da_xoa = false,
    -- nội dung y nguyên mà bản mới không kèm vector → giữ vector cũ
    embedding = case when excluded.embedding is not null then excluded.embedding
                     when t.noi_dung = excluded.noi_dung and t.tieu_de = excluded.tieu_de then t.embedding
                     else null end;
  get diagnostics n = row_count;
  return n;
end $$;

-- Admin gắn vector cho tri thức đã có (học nền). p_rows: [{id, embedding}]
create or replace function public.admin_gan_vector(p_pin text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform public._bat_pin(p_pin);
  update public.tri_thuc t set embedding = (r->>'embedding')::extensions.vector
  from jsonb_array_elements(p_rows) r
  where t.id = r->>'id';
  get diagnostics n = row_count;
  return n;
end $$;

-- Admin xoá (tombstone) — dùng cho cả từ chối đề xuất & xoá đoạn web cũ
create or replace function public.admin_xoa(p_pin text, p_ids text[])
returns int language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform public._bat_pin(p_pin);
  update public.tri_thuc set da_xoa = true, embedding = null, noi_dung = '', tra_loi_sai = null
  where id = any(p_ids) and not da_xoa;
  get diagnostics n = row_count;
  return n;
end $$;

-- Truy xuất RAG: cosine similarity, ưu tiên đính chính của Admin
create or replace function public.tim_tri_thuc(p_embedding extensions.vector(768), p_k int default 6, p_nguong float default 0.55)
returns table (id text, loai text, tieu_de text, noi_dung text, nguon text, sp_id text, diem float)
language sql stable security definer set search_path = public, extensions as $$
  select * from (
    select t.id, t.loai, t.tieu_de, t.noi_dung, t.nguon, t.sp_id,
           (1 - (t.embedding <=> p_embedding)) + case when t.loai = 'sua_sai' then 0.08 else 0 end as diem
    from public.tri_thuc t
    where t.trang_thai = 'da_duyet' and not t.da_xoa and t.embedding is not null
    order by t.embedding <=> p_embedding
    limit greatest(p_k, 1) * 4
  ) x
  where x.diem >= p_nguong
  order by x.diem desc
  limit p_k;
$$;

-- ---------- Giới hạn lượt hỏi Maika (hàm máy chủ "maika" gọi qua kết nối DB, KHÔNG mở cho anon) ----------
create table if not exists public.luot_hoi (
  ngay date not null,
  khoa text not null, -- 'khach:<ip>' | 'noi-bo:<ip>' | 'khach:*' (tổng)
  so   int  not null default 0,
  primary key (ngay, khoa)
);
alter table public.luot_hoi enable row level security;
revoke all on public.luot_hoi from anon, authenticated;

-- Tăng đếm cho khoá riêng + khoá tổng trong ngày (giờ Việt Nam); vượt giới hạn → false (không tăng)
create or replace function public.dem_luot(p_khoa text, p_gioi_han int, p_khoa_tong text, p_gioi_han_tong int)
returns boolean language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; n int; tong int;
begin
  select so into n from public.luot_hoi where ngay = d and khoa = p_khoa;
  select so into tong from public.luot_hoi where ngay = d and khoa = p_khoa_tong;
  if coalesce(n, 0) >= p_gioi_han or coalesce(tong, 0) >= p_gioi_han_tong then
    return false;
  end if;
  insert into public.luot_hoi (ngay, khoa, so) values (d, p_khoa, 1), (d, p_khoa_tong, 1)
  on conflict (ngay, khoa) do update set so = public.luot_hoi.so + 1;
  delete from public.luot_hoi where ngay < d - 30;
  return true;
end $$;
revoke all on function public.dem_luot(text, int, text, int) from public, anon, authenticated;

grant execute on function public.kiem_tra_pin(text), public.de_xuat_sua_sai(text, text, text, text, text),
  public.admin_ghi(text, jsonb), public.admin_gan_vector(text, jsonb), public.admin_xoa(text, text[]),
  public.tim_tri_thuc(extensions.vector, int, float) to anon, authenticated;
