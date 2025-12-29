"""
Kiểm tra bảo mật truy cập video khóa học.

Các test case:
1. Truy cập với token hợp lệ → OK
2. Truy cập không có token → Bị từ chối
3. Truy cập với token không hợp lệ → Bị từ chối
4. Truy cập bài học không tồn tại → 404
5. IDOR: User B không xem được video của User A
6. Signed URL hết hạn → Bị từ chối
7. URL bị sửa đổi (xóa signature) → Bị từ chối
"""
import time
import pytest

from conftest import fetch_lesson, extract_signed_video_url, strip_query, guess_sleep_until_expired
from utils import http_get


class TestXacThuc:
    """Kiểm tra xác thực khi truy cập video."""

    def test_truy_cap_voi_token_hop_le(self, cfg, token_user_a):
        """User có token hợp lệ phải truy cập được lesson."""
        response = fetch_lesson(cfg, token_user_a)
        
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text[:200]}"
        )

    def test_tu_choi_khi_khong_co_token(self, cfg):
        """Request không có token phải bị từ chối."""
        response = fetch_lesson(cfg, token=None)
        
        assert response.status_code in (401, 403), (
            f"Expected 401/403 for unauthenticated request, got {response.status_code}"
        )

    def test_tu_choi_khi_token_gia(self, cfg):
        """Request với token giả phải bị từ chối."""
        fake_token = "invalid.fake.token123"
        response = fetch_lesson(cfg, token=fake_token)
        
        assert response.status_code in (401, 403), (
            f"Expected 401/403 for invalid token, got {response.status_code}"
        )

    def test_tu_choi_khi_bai_hoc_khong_ton_tai(self, cfg, token_user_a):
        """Truy cập lesson ID không tồn tại phải trả về 404."""
        fake_cfg = cfg.copy()
        fake_cfg["lesson_id"] = "99999999"
        
        response = fetch_lesson(fake_cfg, token_user_a)
        
        assert response.status_code == 404, (
            f"Expected 404 for non-existent lesson, got {response.status_code}"
        )


class TestIDOR:
    """Kiểm tra lỗ hổng IDOR - User không được xem tài nguyên của người khác."""

    def test_user_b_khong_xem_duoc_video_cua_user_a(self, cfg, token_user_b):
        """
        User B không có quyền xem lesson mà User A đã mua.
        Lesson ID trong config thuộc về User A.
        """
        response = fetch_lesson(cfg, token_user_b)
        
        if response.status_code == 200:
            data = response.json()
            try:
                video_url = extract_signed_video_url(cfg, data)
                pytest.fail(
                    f"LỖ HỔNG IDOR: User B lấy được video URL của User A: {video_url[:100]}"
                )
            except AssertionError:
                pass
        else:
            assert response.status_code in (403, 404), (
                f"Unexpected status code: {response.status_code}"
            )


class TestSignedURL:
    """Kiểm tra bảo mật của Signed URL."""

    def test_signed_url_hoat_dong_khi_con_han(self, cfg, token_user_a):
        """Signed URL còn hạn phải truy cập được."""
        response = fetch_lesson(cfg, token_user_a)
        assert response.status_code == 200
        
        lesson_data = response.json()
        signed_url = extract_signed_video_url(cfg, lesson_data)
        
        video_response = http_get(signed_url, cfg["timeout"])
        
        assert video_response.status_code in (200, 206), (
            f"Signed URL should work, got {video_response.status_code}"
        )

    def test_tu_choi_url_khong_co_chu_ky(self, cfg, token_user_a):
        """URL bị xóa query params (signature) phải bị từ chối."""
        response = fetch_lesson(cfg, token_user_a)
        assert response.status_code == 200
        
        lesson_data = response.json()
        signed_url = extract_signed_video_url(cfg, lesson_data)
        
        unsigned_url = strip_query(signed_url)
        
        video_response = http_get(unsigned_url, cfg["timeout"])
        
        assert video_response.status_code in (400, 401, 403, 404), (
            f"URL without signature should be rejected, got {video_response.status_code}"
        )

    @pytest.mark.slow
    def test_tu_choi_url_het_han(self, cfg, token_user_a):
        """
        Signed URL hết hạn phải bị từ chối.
        
        CẢNH BÁO: Test này sẽ SLEEP đến khi URL hết hạn!
        """
        response = fetch_lesson(cfg, token_user_a)
        assert response.status_code == 200
        
        lesson_data = response.json()
        signed_url = extract_signed_video_url(cfg, lesson_data)
        
        sleep_seconds = guess_sleep_until_expired(cfg["expiry_fallback_sleep"], signed_url)
        
        print(f"\n⏳ Đang chờ {sleep_seconds}s để URL hết hạn...")
        time.sleep(sleep_seconds)
        
        video_response = http_get(signed_url, cfg["timeout"])
        
        assert video_response.status_code in (400, 401, 403, 410), (
            f"Expired URL should be rejected, got {video_response.status_code}"
        )
