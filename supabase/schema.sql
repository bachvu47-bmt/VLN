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

-- Email Admin mặc định: phiên Supabase Auth (JWT do máy chủ ký) của email này, đã xác minh bằng mã gửi
-- qua email = quyền Admin, không cần PIN. PIN vẫn dùng được (GitHub Actions, script, máy chưa đăng nhập email).
create or replace function public._la_email_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     and lower(coalesce(auth.jwt() ->> 'email', '')) = 'bachvu47@gmail.com'
     and exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null);
$$;
revoke all on function public._la_email_admin() from public, anon, authenticated;

-- App hỏi: phiên đăng nhập email hiện tại có phải Admin không
create or replace function public.la_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public._la_email_admin();
$$;

create or replace function public._bat_pin(p_pin text) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if public._la_email_admin() then
    return;
  end if;
  if not public._pin_dung(coalesce(p_pin, '')) then
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

-- ---------- MAIKA TỰ HỌC ----------
-- Nhật ký hỏi đáp: hàm máy chủ "maika" ghi mỗi lượt; job đêm (scripts/maika-tu-hoc.mjs) đọc qua PIN để
-- tự nghiên cứu câu "chưa có dữ liệu", tự chấm câu trả lời, rút bài học. anon KHÔNG đọc được.
create table if not exists public.nhat_ky (
  id            bigserial primary key,
  luc           timestamptz not null default now(),
  che_do        text not null,
  cau_hoi       text not null default '',
  tra_loi       text not null default '',
  tri_thuc      text not null default '', -- tri thức đã đưa cho Maika (để chấm có bịa không)
  chua_co       boolean not null default false, -- Maika nói "chưa có dữ liệu"
  bi_che        boolean not null default false, -- người hỏi chê câu trả lời trước ("sai rồi"…)
  tu_sua        boolean not null default false, -- máy chủ đã bắt Maika viết lại vì số liệu lạ
  cau_hoi_truoc text,
  tra_loi_truoc text,
  da_xu_ly      boolean not null default false,
  ket_qua       text
);
create index if not exists nhat_ky_cho_idx on public.nhat_ky (da_xu_ly, luc);
alter table public.nhat_ky enable row level security;
revoke all on public.nhat_ky from anon, authenticated;

-- Cấu hình nhỏ dạng khoá–giá trị: 'bai_hoc' = các bài học Maika rút ra từ lỗi cũ (nạp vào mọi câu trả lời)
create table if not exists public.cau_hinh (
  khoa         text primary key,
  gia_tri      text not null default '',
  cap_nhat_luc timestamptz not null default now()
);
alter table public.cau_hinh enable row level security;
drop policy if exists cau_hinh_doc on public.cau_hinh;
create policy cau_hinh_doc on public.cau_hinh for select to anon, authenticated using (true);
revoke insert, update, delete on public.cau_hinh from anon, authenticated;

create or replace function public.admin_doc_nhat_ky(p_pin text, p_gioi_han int default 200)
returns setof public.nhat_ky language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._bat_pin(p_pin);
  return query select * from public.nhat_ky where not da_xu_ly
    order by bi_che desc, chua_co desc, tu_sua desc, luc limit least(greatest(p_gioi_han, 1), 1000);
end $$;

create or replace function public.admin_xong_nhat_ky(p_pin text, p_ids bigint[], p_ket_qua text default null)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform public._bat_pin(p_pin);
  update public.nhat_ky set da_xu_ly = true, ket_qua = left(p_ket_qua, 500) where id = any(p_ids);
  get diagnostics n = row_count;
  delete from public.nhat_ky where luc < now() - interval '60 days';
  return n;
end $$;

create or replace function public.admin_dat_cau_hinh(p_pin text, p_khoa text, p_gia_tri text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._bat_pin(p_pin);
  insert into public.cau_hinh (khoa, gia_tri, cap_nhat_luc) values (p_khoa, left(p_gia_tri, 8000), now())
  on conflict (khoa) do update set gia_tri = excluded.gia_tri, cap_nhat_luc = now();
end $$;

-- ---------- MAIKA TRÊN ZALO OA (hàm máy chủ "zalo") — mọi bảng chỉ hàm máy chủ đọc/ghi qua DB ----------
create table if not exists public.zalo_token (
  id            int primary key default 1 check (id = 1),
  access_token  text not null,
  refresh_token text not null, -- dùng 1 lần: mỗi lần refresh Zalo cấp cái mới
  het_han       timestamptz not null,
  cap_nhat_luc  timestamptz not null default now()
);
create table if not exists public.zalo_cap_quyen (
  state    text primary key,
  verifier text not null, -- PKCE code_verifier, dùng khi Zalo gọi lại kèm code
  luc      timestamptz not null default now()
);
create table if not exists public.zalo_khach (
  user_id      text primary key,
  tam_dung_den timestamptz, -- nhân viên đang trả lời tay → Maika im tới lúc này
  lan_cuoi     timestamptz not null default now()
);
create table if not exists public.zalo_tin (
  id      bigserial primary key,
  user_id text not null,
  tu      text not null check (tu in ('khach', 'maika', 'nhan_vien')),
  text    text not null default '',
  msg_id  text unique, -- chống xử lý trùng khi Zalo gửi lại webhook
  luc     timestamptz not null default now()
);
create index if not exists zalo_tin_khach_idx on public.zalo_tin (user_id, luc);
alter table public.zalo_token enable row level security;
alter table public.zalo_cap_quyen enable row level security;
alter table public.zalo_khach enable row level security;
alter table public.zalo_tin enable row level security;
revoke all on public.zalo_token, public.zalo_cap_quyen, public.zalo_khach, public.zalo_tin from anon, authenticated;

-- scripts/zalo-cap-quyen.mjs: ghi state + code_verifier trước khi mở trang cấp quyền của Zalo
create or replace function public.admin_zalo_bat_dau(p_pin text, p_state text, p_verifier text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._bat_pin(p_pin);
  delete from public.zalo_cap_quyen where luc < now() - interval '1 day';
  insert into public.zalo_cap_quyen (state, verifier) values (p_state, p_verifier);
end $$;

-- ---------- THÔNG BÁO ĐẨY (Firebase Cloud Messaging) ----------
-- Mỗi máy cài app đăng ký token FCM; kèm đúng PIN Admin → nhận cả tin chỉ dành cho Admin (hoá đơn mới, bản tin)
create table if not exists public.thiet_bi (
  token        text primary key,
  ten          text not null default '',
  nen_tang     text not null default 'android',
  la_admin     boolean not null default false,
  cap_nhat_luc timestamptz not null default now()
);
alter table public.thiet_bi enable row level security;
revoke all on public.thiet_bi from anon, authenticated;

create or replace function public.dang_ky_thiet_bi(p_token text, p_ten text, p_nen_tang text, p_pin text default null)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare ad boolean := public._la_email_admin() or (coalesce(p_pin, '') <> '' and public._pin_dung(p_pin));
begin
  if length(coalesce(p_token, '')) < 20 or length(p_token) > 4096 then
    raise exception 'Token thiết bị không hợp lệ';
  end if;
  insert into public.thiet_bi (token, ten, nen_tang, la_admin, cap_nhat_luc)
  values (p_token, left(coalesce(p_ten, ''), 100), left(coalesce(p_nen_tang, 'android'), 20), ad, now())
  on conflict (token) do update set ten = excluded.ten, nen_tang = excluded.nen_tang, la_admin = excluded.la_admin, cap_nhat_luc = now();
  delete from public.thiet_bi where cap_nhat_luc < now() - interval '120 days';
  return ad;
end $$;

-- Hoá đơn KiotViet đã báo (webhook invoice.update bắn cả lúc tạo lẫn lúc sửa → chỉ báo lần đầu)
create table if not exists public.hoa_don_da_bao (
  ma  text primary key,
  luc timestamptz not null default now()
);
alter table public.hoa_don_da_bao enable row level security;
revoke all on public.hoa_don_da_bao from anon, authenticated;

-- ---------- Ảnh sản phẩm do Admin đặt (thay ảnh thiếu/sai trên web & KiotViet) ----------
-- khoa = id thẻ Tra cứu ('wc-123' sản phẩm web, 'kv-…' hàng chỉ có trên KiotViet). Mọi máy đọc; chỉ Admin ghi.
create table if not exists public.anh_san_pham (
  khoa     text primary key,
  url      text not null,
  cap_nhat timestamptz not null default now()
);
alter table public.anh_san_pham enable row level security;
drop policy if exists anh_san_pham_doc on public.anh_san_pham;
create policy anh_san_pham_doc on public.anh_san_pham for select to anon, authenticated using (true);
revoke insert, update, delete on public.anh_san_pham from anon, authenticated;

-- p_url rỗng = xoá ảnh đã đặt (quay về ảnh web / KiotViet / logo)
create or replace function public.admin_dat_anh(p_pin text, p_khoa text, p_url text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._bat_pin(p_pin);
  if length(coalesce(p_khoa, '')) = 0 or length(p_khoa) > 200 then
    raise exception 'Mã sản phẩm không hợp lệ';
  end if;
  if coalesce(p_url, '') = '' then
    delete from public.anh_san_pham where khoa = p_khoa;
    return;
  end if;
  if p_url !~ '^https://' or length(p_url) > 1000 then
    raise exception 'Link ảnh phải bắt đầu bằng https:// (tối đa 1000 ký tự)';
  end if;
  insert into public.anh_san_pham (khoa, url, cap_nhat) values (p_khoa, p_url, now())
  on conflict (khoa) do update set url = excluded.url, cap_nhat = now();
end $$;
grant execute on function public.admin_dat_anh(text, text, text) to anon, authenticated;

-- ---------- KiotViet: phần RIÊNG TƯ (khách hàng, hoá đơn, công nợ) — CHỈ ADMIN ----------
-- GitHub Actions (scripts/kiotviet-sync.mjs) ghi bằng PIN; app chỉ đọc được khi là Admin
-- (phiên email bachvu47@gmail.com hoặc PIN). anon/authenticated không đọc thẳng bảng.
-- Phần công khai (hàng hoá, tồn, giá bán) nằm ở nhánh du-lieu: kiotviet-cong-khai.json.
create table if not exists public.kv_rieng (
  id       int primary key default 1 check (id = 1),
  du_lieu  text not null,          -- base64(gzip(JSON { capNhat, hoaDon, khach }))
  cap_nhat timestamptz not null default now()
);
alter table public.kv_rieng enable row level security;
revoke all on public.kv_rieng from anon, authenticated;

create or replace function public.admin_ghi_kiotviet(p_pin text, p_du_lieu text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._bat_pin(p_pin);
  insert into public.kv_rieng (id, du_lieu, cap_nhat) values (1, p_du_lieu, now())
  on conflict (id) do update set du_lieu = excluded.du_lieu, cap_nhat = now();
end $$;

create or replace function public.admin_doc_kiotviet(p_pin text default null)
returns table (du_lieu text, cap_nhat timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._bat_pin(p_pin);
  return query select k.du_lieu, k.cap_nhat from public.kv_rieng k where k.id = 1;
end $$;

grant execute on function public.admin_ghi_kiotviet(text, text), public.admin_doc_kiotviet(text) to anon, authenticated;

grant execute on function public.kiem_tra_pin(text), public.la_admin(), public.de_xuat_sua_sai(text, text, text, text, text),
  public.admin_zalo_bat_dau(text, text, text), public.dang_ky_thiet_bi(text, text, text, text),
  public.admin_ghi(text, jsonb), public.admin_gan_vector(text, jsonb), public.admin_xoa(text, text[]),
  public.tim_tri_thuc(extensions.vector, int, float),
  public.admin_doc_nhat_ky(text, int), public.admin_xong_nhat_ky(text, bigint[], text),
  public.admin_dat_cau_hinh(text, text, text) to anon, authenticated;
