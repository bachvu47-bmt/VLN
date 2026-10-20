/* ============================================================
   MAIKA TRÊN vatlieunha.vn — khung chat trợ lý kỹ thuật (JS thuần, không thư viện)
   Gắn 1 lần vào WordPress (Flatsome → Advanced → Global Settings → Footer Scripts):
     <script src="https://cdn.jsdelivr.net/gh/bachvu47-bmt/VLN@main/web/maika-widget.js" defer></script>
   - Di động: thay ĐÚNG ô "Tư vấn" (nav.footer-mb .fm-chat) bằng ô Maika, giữ nguyên
     thứ tự & kiểu các ô Cửa hàng · Zalo · Gọi ngay. Script lỗi/không tải → ô Tư vấn cũ vẫn chạy.
   - Máy tính (không có thanh footer-mb): nút Maika nổi góc phải dưới.
   - Hỏi qua hàm máy chủ "maika" (Supabase) — CÙNG bộ não với Maika trong app VatLieuNha Sales.
   ============================================================ */
(function () {
  'use strict'
  if (window.__maikaWidget) return
  window.__maikaWidget = true

  var CAU_HINH = window.MAIKA_CONFIG || {}
  var URL_MAIKA = CAU_HINH.url || 'https://zprcpaboctzvsskmkxou.supabase.co/functions/v1/maika'
  var HOTLINE = '0947 844 446'
  var NUT_NOI_MAY_TINH = CAU_HINH.nutMayTinh !== false
  var src = (document.currentScript && document.currentScript.src) || ''
  var GOC = CAU_HINH.goc || src.replace(/[^/]*$/, '')
  var KHOA_LUU = 'maika_web_lich_su'

  var LOGO =
    '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><linearGradient id="mkwRed" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ef4444"/><stop offset="1" stop-color="#b91c1c"/></linearGradient></defs>' +
    '<rect width="64" height="64" rx="32" fill="url(#mkwRed)"/><path d="M13 31 L32 15 L51 31 V43 a5 5 0 0 1 -5 5 H29 L20 54 V48 H18 a5 5 0 0 1 -5 -5 Z" fill="#fff"/>' +
    '<rect x="24" y="31" width="5" height="9" rx="2.5" fill="#dc2626"/><rect x="35" y="31" width="5" height="9" rx="2.5" fill="#dc2626"/><circle cx="32" cy="10.5" r="2.6" fill="#fff"/></svg>'
  var IC = {
    tool: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-.5-.5-2.5z"/>',
    brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3V4z"/>',
    bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
    cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>',
    send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
  }
  var svg = function (p) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'
  }
  var GOI_Y = ['Chống thấm sân thượng', 'Chọn sơn ngoại thất', 'Tường bị nứt chân chim', 'Tính vật tư lát gạch']
  var LOI_CHAO =
    '<p>Chào anh/chị ạ! Mình là <strong>Maika</strong>, người trợ lý kỹ thuật của <strong>Vật Liệu Nhà</strong>.</p>' +
    '<p>Anh/chị đang gặp vấn đề gì về công trình, hay cần tìm đúng loại vật liệu cho công trình của mình ạ? Cứ <strong>“giao việc”</strong> cho mình nhé!</p>' +
    '<p>Với “bộ não” được học hỏi liên tục hàng ngày từ <strong>hàng ngàn giải pháp thi công thực tế</strong> và cập nhật tri thức ngành Vật Liệu Nhà mỗi ngày, mình sẽ tổng hợp và đưa ra câu trả lời <strong>chuẩn xác, thuyết phục nhất</strong> cho anh/chị ạ.</p>'

  var CSS =
    '.mkw-tab .fm-ic{background:#FDECEC!important}.mkw-tab .fm-ic svg{width:26px!important;height:26px!important}.mkw-tab.mkw-mo .fm-link{background:#FDECEC}' +
    '.mkw-fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:62px;height:62px;border:0;border-radius:50%;padding:0;background:none;cursor:pointer;filter:drop-shadow(0 8px 18px rgba(220,38,38,.38));transition:transform .2s}.mkw-fab:hover{transform:scale(1.06)}.mkw-fab svg{width:100%;height:100%;display:block}' +
    '.mkw{position:fixed;z-index:2147483001;display:none;flex-direction:column;background:#fff;color:#1b1617;font:14px/1.55 "Be Vietnam Pro","Segoe UI",system-ui,-apple-system,sans-serif;overflow:hidden;box-sizing:border-box}.mkw *{box-sizing:border-box}.mkw.mkw-hien{display:flex}' +
    '.mkw.mkw-dd{left:0;right:0;top:0;border-radius:0}.mkw.mkw-mt{right:20px;bottom:96px;width:400px;max-width:calc(100vw - 40px);height:min(640px,calc(100vh - 120px));border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.28)}' +
    '.mkw-head{position:relative;overflow:hidden;flex-shrink:0;min-height:150px;padding:16px 16px 14px;display:flex;flex-direction:column;justify-content:flex-end;color:#fff;background:radial-gradient(120% 140% at 85% 20%,#1d3557,#13233a 60%,#0b1626)}' +
    '.mkw-luoi{position:absolute;inset:0;background-image:linear-gradient(rgba(94,200,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(94,200,255,.08) 1px,transparent 1px);background-size:22px 22px;-webkit-mask-image:linear-gradient(to right,#000,transparent 70%);mask-image:linear-gradient(to right,#000,transparent 70%)}' +
    '.mkw-anh{position:absolute;right:-6px;bottom:0;height:100%;max-width:46%;object-fit:cover;object-position:top;-webkit-mask-image:linear-gradient(to right,transparent 0,#000 22%,#000 80%,transparent 100%);mask-image:linear-gradient(to right,transparent 0,#000 22%,#000 80%,transparent 100%)}' +
    '.mkw-x{position:absolute;top:10px;right:10px;z-index:2;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:20px;line-height:1;cursor:pointer}' +
    '.mkw-who{position:relative;z-index:1;max-width:60%}.mkw-k{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#5ec8ff;font-weight:600}.mkw-ten{font:700 26px/1.2 Lexend,"Segoe UI",system-ui,sans-serif;margin:2px 0}.mkw-sub{font-size:12.5px;color:#cfdbea}' +
    '.mkw-on{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:11.5px;background:rgba(34,197,94,.16);color:#b9f5cf;padding:3px 9px;border-radius:99px}.mkw-on:before{content:"";width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.25)}' +
    '.mkw-feats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:9px 12px;border-bottom:1px solid #eee5e5;flex-shrink:0}.mkw-feat{display:flex;align-items:center;gap:6px;font-size:11px;line-height:1.3;color:#6c6264;font-weight:500;min-width:0}.mkw-feat svg{width:18px;height:18px;flex-shrink:0;color:#dc2626}' +
    '.mkw-msgs{flex:1;min-height:0;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:12px;background:#f6f3f3;-webkit-overflow-scrolling:touch}' +
    '.mkw-m{display:flex;gap:8px;align-items:flex-end}.mkw-m img.mkw-av{width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0}.mkw-b{background:#fff;border:1px solid #eee5e5;border-radius:16px 16px 16px 4px;padding:10px 12px;max-width:86%;min-width:0;overflow-wrap:anywhere}' +
    '.mkw-b p{margin:0 0 6px}.mkw-b p:last-child{margin:0}.mkw-b strong{color:#c81e1e}.mkw-b ul{margin:4px 0 6px;padding-left:18px}.mkw-b li{margin:2px 0}.mkw-b img{display:block;max-width:180px;border-radius:10px;margin-bottom:6px}' +
    '.mkw-m.mkw-u{justify-content:flex-end}.mkw-m.mkw-u .mkw-b{background:#dc2626;color:#fff;border-color:#dc2626;border-radius:16px 16px 4px 16px}.mkw-m.mkw-u .mkw-b strong{color:#fff}' +
    '.mkw-loi .mkw-b{border-color:#fecaca;background:#fff5f5}.mkw-dang i{display:inline-block;width:7px;height:7px;margin:0 2px;border-radius:50%;background:#dc2626;opacity:.35;animation:mkwN 1s infinite}.mkw-dang i:nth-child(2){animation-delay:.15s}.mkw-dang i:nth-child(3){animation-delay:.3s}' +
    '@keyframes mkwN{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}' +
    '.mkw-chips{display:flex;gap:6px;overflow-x:auto;padding:8px 12px 2px;flex-shrink:0;scrollbar-width:none}.mkw-chips::-webkit-scrollbar{display:none}.mkw-chip{flex-shrink:0;border:1px solid #f1d5d5;background:#fff6f6;color:#1b1617;border-radius:99px;padding:6px 11px;font-family:inherit;font-size:12px;font-weight:500;line-height:1.3;cursor:pointer}' +
    '.mkw-xem{display:flex;align-items:center;gap:8px;padding:6px 12px 0;font-size:12px;color:#6c6264}.mkw-xem img{width:44px;height:44px;object-fit:cover;border-radius:8px}.mkw-xem button{border:0;background:none;color:#dc2626;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer}' +
    '.mkw-inp{display:flex;gap:8px;align-items:center;padding:8px 12px 8px;flex-shrink:0;margin:0}.mkw-inp textarea{flex:1;min-width:0;resize:none;border:1px solid #eee5e5;background:#f6f3f3;color:#1b1617;border-radius:20px;padding:10px 14px;font-family:inherit;font-size:15px;line-height:1.35;max-height:110px;outline:none}.mkw-inp textarea:focus{border-color:#dc2626;background:#fff}' +
    '.mkw-cam,.mkw-gui{width:42px;height:42px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;flex-shrink:0;padding:0}.mkw-cam{background:#fff1f1;color:#dc2626}.mkw-gui{background:#dc2626;color:#fff}.mkw-gui:disabled{opacity:.5}.mkw-cam svg,.mkw-gui svg{width:19px;height:19px}' +
    '.mkw-foot{font-size:10.5px;line-height:1.45;color:#6c6264;text-align:center;padding:0 14px 10px;flex-shrink:0}.mkw-foot a{color:#c81e1e;font-weight:600;text-decoration:none}' +
    '.mkw button:focus-visible,.mkw textarea:focus-visible,.mkw-fab:focus-visible{outline:2px solid #5ec8ff;outline-offset:2px}' +
    '@media (prefers-reduced-motion:reduce){.mkw-dang i{animation:none}.mkw-fab{transition:none}}'

  // ---------- tiện ích ----------
  function thoat(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
  // Markdown tối thiểu: **đậm**, gạch đầu dòng, xuống dòng
  function dinhDang(text) {
    var khoi = [], ds = null
    String(text).split(/\n/).forEach(function (dong) {
      var t = thoat(dong).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^#{1,4}\s*/, '')
      var m = t.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
      if (m) {
        if (!ds) { ds = []; khoi.push(ds) }
        ds.push(m[1])
      } else {
        ds = null
        if (t.trim()) khoi.push('<p>' + t + '</p>')
      }
    })
    return khoi.map(function (k) { return Array.isArray(k) ? '<ul><li>' + k.join('</li><li>') + '</li></ul>' : k }).join('')
  }
  function docLuu() {
    try { return JSON.parse(sessionStorage.getItem(KHOA_LUU) || '[]') } catch (e) { return [] }
  }
  function ghiLuu(ds) {
    try { sessionStorage.setItem(KHOA_LUU, JSON.stringify(ds.slice(-20))) } catch (e) { /* bỏ qua */ }
  }
  // Ảnh điện thoại (3–8MB) → JPEG ≤ 1280px
  function thuNhoAnh(file) {
    return new Promise(function (ok, loi) {
      var img = new Image(), url = URL.createObjectURL(file)
      img.onload = function () {
        var tl = Math.min(1, 1280 / Math.max(img.width, img.height))
        var c = document.createElement('canvas')
        c.width = Math.round(img.width * tl); c.height = Math.round(img.height * tl)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        URL.revokeObjectURL(url)
        var du = c.toDataURL('image/jpeg', 0.82)
        ok({ mime: 'image/jpeg', base64: du.split(',')[1], xem: du })
      }
      img.onerror = function () { URL.revokeObjectURL(url); loi(new Error('anh')) }
      img.src = url
    })
  }

  // ---------- dựng giao diện ----------
  function khoiDong() {
    var st = document.createElement('style')
    st.id = 'maika-widget-css'
    st.textContent = CSS
    document.head.appendChild(st)

    var lichSu = docLuu() // [{tu, text, coAnh}]
    var anhCho = null
    var dangGui = false

    var hop = document.createElement('div')
    hop.className = 'mkw'
    hop.setAttribute('role', 'dialog')
    hop.setAttribute('aria-label', 'Trò chuyện với Maika')
    hop.innerHTML =
      '<div class="mkw-head"><div class="mkw-luoi"></div><img class="mkw-anh" alt="" src="' + GOC + 'maika-portrait.jpg">' +
      '<button type="button" class="mkw-x" aria-label="Đóng khung chat">×</button>' +
      '<div class="mkw-who"><div class="mkw-k">Trợ lý kỹ thuật AI</div><div class="mkw-ten">Maika</div><div class="mkw-sub">Vật Liệu Nhà · hỗ trợ 24/7</div><span class="mkw-on">Đang trực tuyến</span></div></div>' +
      '<div class="mkw-feats"><div class="mkw-feat">' + svg(IC.tool) + 'Tư vấn thi công chính xác</div><div class="mkw-feat">' + svg(IC.brain) + 'Tri thức cập nhật mỗi ngày</div><div class="mkw-feat">' + svg(IC.bolt) + 'Trả lời trong vài giây</div></div>' +
      '<div class="mkw-msgs" aria-live="polite"></div>' +
      '<div class="mkw-chips"></div><div class="mkw-xem" hidden></div>' +
      '<form class="mkw-inp"><button type="button" class="mkw-cam" aria-label="Gửi ảnh công trình">' + svg(IC.cam) + '</button>' +
      '<input type="file" accept="image/*" hidden>' +
      '<textarea rows="1" placeholder="Nhập câu hỏi cho Maika…" aria-label="Câu hỏi cho Maika"></textarea>' +
      '<button type="submit" class="mkw-gui" aria-label="Gửi">' + svg(IC.send) + '</button></form>' +
      '<div class="mkw-foot">Maika là trợ lý AI, mình có thể bị sai nhưng mình cố gắng để hoàn thiện hơn mỗi ngày.<br>Cần kỹ thuật viên: <a href="tel:0947844446">' + HOTLINE + '</a></div>'
    document.body.appendChild(hop)

    var msgs = hop.querySelector('.mkw-msgs')
    var chips = hop.querySelector('.mkw-chips')
    var xem = hop.querySelector('.mkw-xem')
    var form = hop.querySelector('form')
    var oNhap = form.querySelector('textarea')
    var oFile = form.querySelector('input[type=file]')
    var nutGui = form.querySelector('.mkw-gui')

    function cuon() { msgs.scrollTop = msgs.scrollHeight }
    function themTin(tu, html, them) {
      var d = document.createElement('div')
      d.className = 'mkw-m' + (tu === 'user' ? ' mkw-u' : '') + (them ? ' ' + them : '')
      d.innerHTML = (tu === 'user' ? '' : '<img class="mkw-av" alt="" src="' + GOC + 'maika-face.jpg">') + '<div class="mkw-b">' + html + '</div>'
      msgs.appendChild(d)
      cuon()
      return d
    }
    function veLai() {
      msgs.innerHTML = ''
      themTin('maika', LOI_CHAO)
      lichSu.forEach(function (m) {
        themTin(m.tu, m.tu === 'user' ? (m.coAnh ? '<p>📷 (đã gửi ảnh)</p>' : '') + dinhDang(m.text) : dinhDang(m.text))
      })
      chips.hidden = lichSu.length > 0
    }
    GOI_Y.forEach(function (g) {
      var b = document.createElement('button')
      b.type = 'button'; b.className = 'mkw-chip'; b.textContent = g
      b.onclick = function () { hoi(g) }
      chips.appendChild(b)
    })
    veLai()

    function hienAnhCho() {
      if (!anhCho) { xem.hidden = true; xem.innerHTML = ''; return }
      xem.hidden = false
      xem.innerHTML = '<img alt="Ảnh sẽ gửi" src="' + anhCho.xem + '"><span>Ảnh sẽ gửi kèm câu hỏi</span><button type="button">Bỏ ảnh</button>'
      xem.querySelector('button').onclick = function () { anhCho = null; hienAnhCho() }
    }
    form.querySelector('.mkw-cam').onclick = function () { oFile.click() }
    oFile.onchange = function () {
      var f = oFile.files && oFile.files[0]
      oFile.value = ''
      if (!f) return
      thuNhoAnh(f).then(function (a) { anhCho = a; hienAnhCho(); oNhap.focus() }).catch(function () {
        themTin('maika', '<p>Mình chưa đọc được ảnh này. Anh/chị chọn ảnh JPG/PNG khác giúp mình nhé.</p>', 'mkw-loi')
      })
    }

    function hoi(cau) {
      cau = (cau || '').trim()
      if (dangGui || (!cau && !anhCho)) return
      dangGui = true; nutGui.disabled = true; chips.hidden = true
      var anh = anhCho
      anhCho = null; hienAnhCho()
      var tinMoi = { tu: 'user', text: cau || 'Anh/chị xem giúp ảnh hiện trạng này.', coAnh: !!anh }
      themTin('user', (anh ? '<img alt="" src="' + anh.xem + '">' : '') + dinhDang(tinMoi.text))
      lichSu.push(tinMoi)
      ghiLuu(lichSu)
      var cho = themTin('maika', '<span class="mkw-dang" aria-label="Maika đang trả lời"><i></i><i></i><i></i></span>')
      var guiDi = lichSu.slice(-12).map(function (m, i, a) {
        var o = { tu: m.tu, text: m.text, coAnh: !!m.coAnh }
        if (i === a.length - 1 && anh) o.anh = { mime: anh.mime, base64: anh.base64 }
        return o
      })
      fetch(URL_MAIKA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cheDo: 'khach', lichSu: guiDi }) })
        .then(function (r) { return r.json().catch(function () { return {} }).then(function (j) { return { ok: r.ok, j: j } }) })
        .then(function (kq) {
          cho.remove()
          if (kq.ok && kq.j.text) {
            themTin('maika', dinhDang(kq.j.text))
            lichSu.push({ tu: 'maika', text: kq.j.text })
            ghiLuu(lichSu)
          } else {
            themTin('maika', '<p>' + thoat(kq.j.loi || 'Maika đang bận, anh/chị thử lại sau ít phút ạ.') + '</p>', 'mkw-loi')
          }
        })
        .catch(function () {
          cho.remove()
          themTin('maika', '<p>Mất kết nối tới Maika. Anh/chị kiểm tra mạng rồi gửi lại, hoặc gọi ' + HOTLINE + ' ạ.</p>', 'mkw-loi')
        })
        .then(function () { dangGui = false; nutGui.disabled = false })
    }
    form.onsubmit = function (e) {
      e.preventDefault()
      var c = oNhap.value
      oNhap.value = ''; oNhap.style.height = ''
      hoi(c)
    }
    oNhap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.onsubmit(e) }
    })
    oNhap.addEventListener('input', function () { oNhap.style.height = ''; oNhap.style.height = Math.min(oNhap.scrollHeight, 110) + 'px' })

    // ---------- mở / đóng ----------
    var o = document.querySelector('nav.footer-mb .fm-chat')
    var thanh = document.querySelector('nav.footer-mb')
    var fab = null
    var cuonCu = ''
    // offsetParent luôn null với phần tử position:fixed (nav.footer-mb) → dùng display thật của thanh
    function laDiDong() { return !!(thanh && o && getComputedStyle(thanh).display !== 'none') }
    function mo() {
      var dd = laDiDong()
      hop.classList.toggle('mkw-dd', dd)
      hop.classList.toggle('mkw-mt', !dd)
      if (dd) {
        hop.style.bottom = thanh.offsetHeight + 'px'
        cuonCu = document.documentElement.style.overflow
        document.documentElement.style.overflow = 'hidden'
      } else {
        hop.style.bottom = ''
      }
      hop.classList.add('mkw-hien')
      if (o) o.classList.add('mkw-mo')
      cuon()
      if (!dd) oNhap.focus()
    }
    function dong() {
      hop.classList.remove('mkw-hien')
      if (o) o.classList.remove('mkw-mo')
      document.documentElement.style.overflow = cuonCu
    }
    function batTat(e) {
      if (e) e.preventDefault()
      hop.classList.contains('mkw-hien') ? dong() : mo()
    }
    hop.querySelector('.mkw-x').onclick = dong
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && hop.classList.contains('mkw-hien')) dong() })

    // Ô "Tư vấn" → ô Maika (giữ nguyên vị trí, chỉ đổi icon + chữ + hành động)
    if (o) {
      var link = o.querySelector('.fm-link') || o.querySelector('a')
      if (link) {
        o.classList.add('mkw-tab')
        var ic = link.querySelector('.fm-ic')
        var tx = link.querySelector('.fm-tx')
        if (ic) ic.innerHTML = LOGO
        if (tx) tx.textContent = 'Maika'
        link.setAttribute('role', 'button')
        link.setAttribute('aria-label', 'Mở trò chuyện với Maika, trợ lý kỹ thuật')
        link.addEventListener('click', batTat)
      }
    }
    // Máy tính: nút nổi (ẩn khi đang hiện thanh điều hướng di động)
    if (NUT_NOI_MAY_TINH) {
      fab = document.createElement('button')
      fab.type = 'button'; fab.className = 'mkw-fab'; fab.innerHTML = LOGO
      fab.setAttribute('aria-label', 'Mở trò chuyện với Maika, trợ lý kỹ thuật')
      fab.onclick = batTat
      document.body.appendChild(fab)
      var anHienFab = function () { fab.style.display = laDiDong() ? 'none' : '' }
      anHienFab()
      window.addEventListener('resize', anHienFab)
    }
    window.addEventListener('resize', function () {
      if (hop.classList.contains('mkw-hien') && hop.classList.contains('mkw-dd') !== laDiDong()) { dong(); mo() }
    })
    window.Maika = { mo: mo, dong: dong }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoiDong)
  else khoiDong()
})()
