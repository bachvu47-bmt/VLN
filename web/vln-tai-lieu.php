<?php
/**
 * Plugin Name: VLN – Link tài liệu thương hiệu
 * Description: Link rút gọn gửi khách: vatlieunha.vn/tai-lieu/<slug-sản-phẩm> → trang sản phẩm; /tai-lieu/<slug>/pdf → tệp PDF đầu tiên trong mô tả sản phẩm. App VatLieuNha Sales tự kiểm tra plugin qua /tai-lieu/?kiem-tra=1.
 * Version: 1.0.0
 *
 * Cài: chép file này vào wp-content/mu-plugins/ (tạo thư mục nếu chưa có) — tự chạy, không cần kích hoạt.
 */

if (!defined('ABSPATH')) {
	exit;
}

add_action('template_redirect', function () {
	$duong_dan = trim((string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
	if (!preg_match('#^tai-lieu(?:/([a-z0-9-]+))?(?:/(pdf))?$#i', $duong_dan, $m)) {
		return;
	}

	// App kiểm tra plugin đã cài
	if (empty($m[1])) {
		header('Access-Control-Allow-Origin: *');
		header('Content-Type: text/plain; charset=utf-8');
		echo 'vln-tai-lieu ok';
		exit;
	}

	$sp = get_page_by_path(sanitize_title($m[1]), OBJECT, 'product');
	if (!$sp || $sp->post_status !== 'publish') {
		wp_safe_redirect(home_url('/'), 302);
		exit;
	}

	if (!empty($m[2])) {
		// Cùng thứ tự app dùng (mô tả ngắn rồi mô tả dài) → "pdf" trỏ đúng tệp app hiển thị đầu tiên
		$html = $sp->post_excerpt . ' ' . $sp->post_content;
		if (preg_match('#https?://[^"\'\s<>]+\.pdf#i', $html, $pdf)) {
			wp_redirect(esc_url_raw($pdf[0]), 302); // PDF có thể nằm ở miền khác (nhà sản xuất)
			exit;
		}
	}

	wp_safe_redirect(get_permalink($sp), 302);
	exit;
}, 0);
