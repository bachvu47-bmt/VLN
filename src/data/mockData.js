// ============================================================
//  DỮ LIỆU MẪU — Khôi Anh Home Center (Vật Liệu Nhà)
//  Lưu ý: Đây là mock data phục vụ demo ứng dụng nội bộ.
// ============================================================

// ---------- NGƯỜI DÙNG & PHÂN QUYỀN ----------
export const VAI_TRO = {
  admin: { ma: 'admin', ten: 'Quản trị viên', mau: 'bg-brand-600' },
  sales: { ma: 'sales', ten: 'Nhân viên Sales', mau: 'bg-blue-600' },
  thukho: { ma: 'thukho', ten: 'Thủ kho', mau: 'bg-amber-600' },
}

export const NGUOI_DUNG = [
  {
    id: 'u1',
    hoTen: 'Vũ Bạch Khoa',
    email: 'khoa.vb@vatlieunha.vn',
    username: 'khoavb',
    sdt: '0909123456',
    matKhau: '123456',
    vaiTro: 'admin',
    chucVu: 'Giám đốc / Admin hệ thống',
  },
  {
    id: 'u2',
    hoTen: 'Trần Mỹ Linh',
    email: 'linh.tm@vatlieunha.vn',
    username: 'linhtm',
    sdt: '0912345678',
    matKhau: '123456',
    vaiTro: 'sales',
    chucVu: 'Trưởng nhóm Sales',
  },
  {
    id: 'u3',
    hoTen: 'Nguyễn Văn Hùng',
    email: 'hung.nv@vatlieunha.vn',
    username: 'hungnv',
    sdt: '0987654321',
    matKhau: '123456',
    vaiTro: 'sales',
    chucVu: 'Nhân viên Sales',
  },
  {
    id: 'u4',
    hoTen: 'Lê Thị Hoa',
    email: 'hoa.lt@vatlieunha.vn',
    username: 'hoalt',
    sdt: '0938111222',
    matKhau: '123456',
    vaiTro: 'thukho',
    chucVu: 'Thủ kho chính',
  },
]

// ---------- SẢN PHẨM & TRA CỨU KỸ THUẬT ----------
export const SAN_PHAM = [
  {
    id: 'sp1',
    ma: 'SIKA-LTX-TH',
    ten: 'SikaLatex TH',
    nhom: 'Phụ gia & Kết nối',
    hangSX: 'Sika',
    donVi: 'Can 5L / 25L',
    icon: '🧴',
    moTa:
      'Phụ gia latex đa năng, trộn với xi măng/vữa để tăng khả năng bám dính, chống thấm và chống nứt cho lớp hồ dầu kết nối.',
    tyLePha: [
      { buoc: 'Hồ dầu kết nối', noiDung: 'SikaLatex TH : Nước = 1 : 2, trộn với xi măng tới dạng hồ sệt.' },
      { buoc: 'Vữa chống thấm', noiDung: 'SikaLatex TH : Nước = 1 : 3, trộn vữa tỷ lệ XM:Cát = 1:3.' },
    ],
    canhBao: [
      'KHÔNG dùng làm lớp chống thấm độc lập — phải trộn cùng xi măng.',
      'KHÔNG thi công khi nhiệt độ bề mặt > 35°C hoặc trời mưa.',
    ],
    dinhMuc: { donVi: 'lít/m²', giaTri: 0.2, ghiChu: 'Cho 1 lớp hồ dầu kết nối dày ~1mm.' },
    video: 'https://youtu.be/sika-latex-th-demo',
    taiLieu: ['TDS_SikaLatex_TH.pdf', 'Huong_dan_tron_ho_dau.pdf'],
    tags: ['latex', 'kết nối', 'phụ gia', 'bám dính'],
  },
  {
    id: 'sp2',
    ma: 'RAMSET-G5-PRO',
    ten: 'Keo Ramset G5 Pro',
    nhom: 'Keo cấy thép / Hóa chất',
    hangSX: 'Ramset',
    donVi: 'Tuýp 390ml',
    icon: '💉',
    moTa:
      'Keo epoxy 2 thành phần dùng cấy thép, bu lông vào bê tông, cường độ bám dính cao, phù hợp kết cấu chịu lực.',
    tyLePha: [
      { buoc: 'Tỷ lệ thành phần', noiDung: 'Trộn sẵn trong tuýp (A:B), bơm bằng súng chuyên dụng.' },
      { buoc: 'Bỏ keo đầu tuýp', noiDung: 'Bơm bỏ ~5cm keo đầu tiên cho tới khi màu đồng nhất.' },
    ],
    canhBao: [
      'CẤM cấy thép khi lỗ khoan còn bụi/ẩm — phải thổi & vệ sinh sạch lỗ.',
      'KHÔNG chịu tải trước khi keo đủ thời gian đông kết (xem bảng theo nhiệt độ).',
    ],
    dinhMuc: { donVi: 'tuýp/vị trí', giaTri: 0.15, ghiChu: '1 tuýp cấy ~6-8 vị trí D16, lỗ sâu 120mm.' },
    video: 'https://youtu.be/ramset-g5-pro-cay-thep',
    taiLieu: ['TDS_Ramset_G5_Pro.pdf', 'Bang_thoi_gian_dong_ket.pdf'],
    tags: ['keo', 'cấy thép', 'epoxy', 'kết cấu'],
  },
  {
    id: 'sp3',
    ma: 'MAXBOND-1211',
    ten: 'Maxbond 1211',
    nhom: 'Chống thấm gốc xi măng',
    hangSX: 'Maxbond',
    donVi: 'Bộ 20kg (A+B)',
    icon: '🪣',
    moTa:
      'Chống thấm 2 thành phần gốc xi măng polymer, đàn hồi, thi công cho sàn mái, nhà vệ sinh, bể nước, tường.',
    tyLePha: [
      { buoc: 'Tỷ lệ trộn', noiDung: 'Thành phần A (lỏng) : B (bột) = 1 : 2 theo khối lượng.' },
      { buoc: 'Thi công', noiDung: 'Quét 2-3 lớp, mỗi lớp cách nhau 2-4 giờ, lớp sau vuông góc lớp trước.' },
    ],
    canhBao: [
      'CẤM pha thêm nước ngoài định mức — làm giảm cường độ & gây nứt.',
      'KHÔNG thi công lớp tiếp theo khi lớp trước chưa khô se mặt.',
    ],
    dinhMuc: { donVi: 'kg/m²', giaTri: 2.0, ghiChu: 'Cho 2 lớp, tổng dày ~1.5mm. 1 bộ 20kg ~10m².' },
    video: 'https://youtu.be/maxbond-1211-nha-ve-sinh',
    taiLieu: ['TDS_Maxbond_1211.pdf', 'Quy_trinh_WC.pdf'],
    tags: ['chống thấm', 'xi măng', 'polymer', 'nhà vệ sinh', 'sàn mái'],
  },
  {
    id: 'sp4',
    ma: 'NEOPROOF-PU-W',
    ten: 'Chống thấm Neoproof PU W',
    nhom: 'Chống thấm gốc PU (Polyurethane)',
    hangSX: 'Neotex',
    donVi: 'Thùng 13kg',
    icon: '🛢️',
    moTa:
      'Màng chống thấm Polyurethane 1 thành phần, gốc nước, đàn hồi cao, lộ thiên, phản xạ nhiệt — chuyên cho sàn mái.',
    tyLePha: [
      { buoc: 'Lớp lót', noiDung: 'Pha loãng lớp đầu với ~10% nước sạch để tăng thẩm thấu.' },
      { buoc: 'Lớp phủ', noiDung: 'Dùng nguyên chất, lăn 2 lớp vuông góc nhau.' },
    ],
    canhBao: [
      '🚫 CẤM LĂN PU KHI SÀN ẨM > 8% — màng sẽ phồng rộp, bong tróc toàn bộ.',
      'CẤM thi công khi trời sắp mưa trong 6 giờ hoặc nhiệt độ < 8°C.',
    ],
    dinhMuc: { donVi: 'kg/m²', giaTri: 1.5, ghiChu: 'Cho 2 lớp. 1 thùng 13kg ~8-9m². Dùng máy đo ẩm trước khi thi công.' },
    video: 'https://youtu.be/neoproof-pu-w-san-mai',
    taiLieu: ['TDS_Neoproof_PU_W.pdf', 'Checklist_do_am_san.pdf'],
    tags: ['chống thấm', 'PU', 'polyurethane', 'sàn mái', 'lộ thiên'],
  },
  {
    id: 'sp5',
    ma: 'CEMBOARD-SCG',
    ten: 'Tấm Cemboard SCG',
    nhom: 'Tấm xi măng / Vật liệu tấm',
    hangSX: 'SCG',
    donVi: 'Tấm 1220×2440mm',
    icon: '🪟',
    moTa:
      'Tấm xi măng sợi cellulose chịu nước, chịu lực, chống cháy — làm sàn giả, vách ngăn, trần, lót mái.',
    tyLePha: [
      { buoc: 'Khoảng cách khung', noiDung: 'Xương sắt hộp cách nhau ≤ 407mm cho tấm sàn 16-20mm.' },
      { buoc: 'Khe co giãn', noiDung: 'Chừa khe 3-5mm giữa các tấm, xử lý bằng keo + lưới.' },
    ],
    canhBao: [
      'KHÔNG bắt vít sát mép < 15mm — tấm dễ bị nứt vỡ góc.',
      'CẤM dùng tấm độ dày thấp (< 16mm) làm sàn chịu tải đi lại.',
    ],
    dinhMuc: { donVi: 'tấm/m²', giaTri: 0.336, ghiChu: '1 tấm phủ ~2.98m². Tính dư 5-8% cho cắt ghép.' },
    video: 'https://youtu.be/cemboard-scg-lam-san',
    taiLieu: ['Catalogue_Cemboard_SCG.pdf', 'Huong_dan_lam_san_gac.pdf'],
    tags: ['cemboard', 'tấm xi măng', 'sàn giả', 'vách ngăn', 'SCG'],
  },
]

// ---------- ĐƠN HÀNG (GIẢ LẬP ĐỒNG BỘ KIOTVIET) ----------
export const DON_HANG = [
  {
    id: 'dh1',
    maDon: 'KV-10482',
    khach: 'Anh Dũng (Thầu xây dựng)',
    sdt: '0901223344',
    ngay: '2026-10-17',
    kenh: 'KiotViet',
    trangThai: 'Đã giao',
    sanPham: [
      { ma: 'SIKA-LTX-TH', ten: 'SikaLatex TH', soLuong: 2, donVi: 'can 5L' },
      { ma: 'MAXBOND-1211', ten: 'Maxbond 1211', soLuong: 3, donVi: 'bộ 20kg' },
    ],
    goiY: 'Khách mua chống thấm WC — tư vấn quy trình quét 2-3 lớp + lưu ý bo góc chân tường.',
  },
  {
    id: 'dh2',
    maDon: 'KV-10485',
    khach: 'Chị Lan (Nhà dân)',
    sdt: '0938556677',
    ngay: '2026-10-17',
    kenh: 'KiotViet',
    trangThai: 'Đang xử lý',
    sanPham: [
      { ma: 'NEOPROOF-PU-W', ten: 'Chống thấm Neoproof PU W', soLuong: 2, donVi: 'thùng 13kg' },
    ],
    goiY: 'Chống thấm sàn mái lộ thiên — BẮT BUỘC cảnh báo khách đo độ ẩm sàn < 8% trước khi lăn.',
  },
  {
    id: 'dh3',
    maDon: 'KV-10491',
    khach: 'Anh Tâm (Xưởng cơ khí)',
    sdt: '0977889900',
    ngay: '2026-10-18',
    kenh: 'KiotViet',
    trangThai: 'Mới',
    sanPham: [
      { ma: 'RAMSET-G5-PRO', ten: 'Keo Ramset G5 Pro', soLuong: 6, donVi: 'tuýp 390ml' },
      { ma: 'CEMBOARD-SCG', ten: 'Tấm Cemboard SCG', soLuong: 20, donVi: 'tấm' },
    ],
    goiY: 'Khách cấy thép + làm sàn gác. Tư vấn vệ sinh lỗ khoan & khoảng cách xương sắt ≤ 407mm.',
  },
]

// ---------- PHIÊN ĐĂNG NHẬP / THIẾT BỊ ----------
export const PHIEN_DANG_NHAP = [
  {
    id: 's1',
    userId: 'u1',
    nguoiDung: 'Vũ Bạch Khoa',
    thietBi: 'Windows PC — Dell OptiPlex',
    nenTang: 'windows',
    ip: '192.168.1.10',
    diaDiem: 'Văn phòng Q1',
    hoatDong: 'Vừa xong',
    active: true,
  },
  {
    id: 's2',
    userId: 'u1',
    nguoiDung: 'Vũ Bạch Khoa',
    thietBi: 'iPhone 15 Pro',
    nenTang: 'ios',
    ip: '10.0.0.5',
    diaDiem: 'Di động (4G)',
    hoatDong: '5 phút trước',
    active: true,
  },
  {
    id: 's3',
    userId: 'u2',
    nguoiDung: 'Trần Mỹ Linh',
    thietBi: 'Samsung Galaxy S24',
    nenTang: 'android',
    ip: '10.0.0.8',
    diaDiem: 'Kho Thủ Đức',
    hoatDong: '20 phút trước',
    active: true,
  },
  {
    id: 's4',
    userId: 'u3',
    nguoiDung: 'Nguyễn Văn Hùng',
    thietBi: 'Windows PC — HP ProBook',
    nenTang: 'windows',
    ip: '192.168.1.22',
    diaDiem: 'Văn phòng Q1',
    hoatDong: '1 giờ trước',
    active: true,
  },
  {
    id: 's5',
    userId: 'u4',
    nguoiDung: 'Lê Thị Hoa',
    thietBi: 'iPad Air',
    nenTang: 'ios',
    ip: '192.168.1.30',
    diaDiem: 'Kho Thủ Đức',
    hoatDong: '2 giờ trước',
    active: false,
  },
]
