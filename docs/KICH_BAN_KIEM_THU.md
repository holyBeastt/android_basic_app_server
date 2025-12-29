# 📋 KỊCH BẢN KIỂM THỬ THỦ CÔNG
## Phần 1: Đăng nhập sai nhiều lần - Khóa tài khoản
## Phần 2: Kiểm tra SQL Injection

---

# 🔐 PHẦN 1: KIỂM THỬ KHÓA TÀI KHOẢN SAU 5 LẦN SAI

## Mục tiêu
- Kiểm tra tài khoản bị khóa sau 5 lần nhập sai mật khẩu
- Kiểm tra email chứa mã OTP được gửi
- Kiểm tra mã OTP mở khóa hoạt động đúng
- Kiểm tra chức năng gửi lại mã

---

## TC-01: Đăng nhập sai 1-4 lần
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Mở app, vào màn hình Login | Hiển thị form đăng nhập |
| 2 | Nhập username đúng, password SAI lần 1 | Thông báo: "Sai mật khẩu. Bạn còn 4 lần thử" |
| 3 | Nhập password SAI lần 2 | Thông báo: "Sai mật khẩu. Bạn còn 3 lần thử" |
| 4 | Nhập password SAI lần 3 | Thông báo: "Sai mật khẩu. Bạn còn 2 lần thử" |
| 5 | Nhập password SAI lần 4 | Thông báo: "Sai mật khẩu. Bạn còn 1 lần thử" |

**Kết quả:** ✅ PASS / ❌ FAIL

---

## TC-02: Đăng nhập sai lần thứ 5 - Khóa tài khoản
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Tiếp tục từ TC-01, nhập password SAI lần 5 | - Form đăng nhập bị ẨN<br>- Hiển thị form nhập mã OTP<br>- Thông báo: "Tài khoản bị khóa. Mã xác thực đã gửi về email" |
| 2 | Kiểm tra email của tài khoản | - Nhận được email từ hệ thống<br>- Email chứa mã 6 số |

**Kết quả:** ✅ PASS / ❌ FAIL

---

## TC-03: Nhập mã OTP đúng
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Tiếp tục từ TC-02 | Đang ở màn hình nhập mã OTP |
| 2 | Nhập mã 6 số từ email | - Thông báo: "Xác thực thành công!"<br>- Quay lại form đăng nhập bình thường |
| 3 | Nhập đúng username + password | Đăng nhập thành công |

**Kết quả:** ✅ PASS / ❌ FAIL

---

## TC-04: Nhập mã OTP sai
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Khóa tài khoản (nhập sai 5 lần) | Hiển thị form nhập mã OTP |
| 2 | Nhập mã SAI (VD: 123456 thay vì 847291) | - Thông báo: "Mã xác thực không đúng"<br>- Vẫn ở form nhập mã |
| 3 | Nhập mã SAI lần 2 | Thông báo: "Mã xác thực không đúng" |

**Kết quả:** ✅ PASS / ❌ FAIL

---

## TC-05: Mã OTP hết hạn
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Khóa tài khoản (nhập sai 5 lần) | Nhận email chứa mã OTP |
| 2 | Đợi 10 phút (hoặc sửa thời gian trong DB) | Mã đã quá thời hạn |
| 3 | Nhập mã OTP (đã hết hạn) | Thông báo: "Mã đã hết hạn. Vui lòng gửi lại mã mới" |

**Kết quả:** ✅ PASS / ❌ FAIL

---

## TC-06: Gửi lại mã OTP
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Ở form nhập mã OTP | Có nút "Gửi lại mã" |
| 2 | Ấn nút "Gửi lại mã" | - Thông báo: "Mã mới đã được gửi về email"<br>- Nhận email mới với mã khác |
| 3 | Nhập mã mới | Xác thực thành công |

**Kết quả:** ✅ PASS / ❌ FAIL

---

## TC-07: Quay lại form đăng nhập khi đang bị khóa
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Ở form nhập mã OTP | Có nút "Quay lại đăng nhập" |
| 2 | Ấn nút "Quay lại đăng nhập" | Hiển thị form đăng nhập |
| 3 | Nhập username + password (dù đúng) | - Không cho đăng nhập<br>- Quay lại form nhập mã OTP<br>- Thông báo: "Tài khoản đang bị khóa" |

**Kết quả:** ✅ PASS / ❌ FAIL

---

## TC-08: Reset số lần sai sau đăng nhập thành công
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Nhập sai mật khẩu 3 lần | Thông báo: "Còn 2 lần thử" |
| 2 | Nhập ĐÚNG mật khẩu | Đăng nhập thành công |
| 3 | Đăng xuất | Về màn hình login |
| 4 | Nhập sai mật khẩu 1 lần | Thông báo: "Còn 4 lần thử" (reset về 0) |

**Kết quả:** ✅ PASS / ❌ FAIL

---

# 💉 PHẦN 2: KIỂM THỬ SQL INJECTION

## Mục tiêu
- Kiểm tra hệ thống có bị tấn công SQL Injection không
- Xác nhận dữ liệu đầu vào được xử lý an toàn

---

## TC-SQL-01: SQL Injection trong Username
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Vào màn hình Login | Hiển thị form đăng nhập |
| 2 | Nhập username: `' OR '1'='1` | Không đăng nhập được |
| 3 | Nhập username: `admin'--` | Không đăng nhập được |
| 4 | Nhập username: `'; DROP TABLE users;--` | Không đăng nhập được, DB không bị ảnh hưởng |

**Kết quả mong đợi:** Tất cả đều báo "Tên đăng nhập không tồn tại" hoặc "Sai mật khẩu"

**Kết quả:** ✅ PASS / ❌ FAIL

---

## TC-SQL-02: SQL Injection trong Password
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Nhập username hợp lệ | - |
| 2 | Nhập password: `' OR '1'='1` | Không đăng nhập được |
| 3 | Nhập password: `password' OR 1=1--` | Không đăng nhập được |

**Kết quả mong đợi:** Báo "Sai mật khẩu"

**Kết quả:** ✅ PASS / ❌ FAIL

---

## TC-SQL-03: SQL Injection trong Email (Forgot Password)
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Vào màn hình "Quên mật khẩu" | Hiển thị form nhập email |
| 2 | Nhập email: `' OR '1'='1` | Không crash, trả về bình thường |
| 3 | Nhập email: `test@test.com'; DROP TABLE users;--` | Không crash, DB không bị ảnh hưởng |

**Kết quả mong đợi:** Thông báo "Nếu email tồn tại, mã sẽ được gửi"

**Kết quả:** ✅ PASS / ❌ FAIL

---

## TC-SQL-04: SQL Injection trong Mã OTP
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Khóa tài khoản (sai 5 lần) | Hiển thị form nhập mã OTP |
| 2 | Nhập mã: `' OR '1'='1` | Không mở khóa được |
| 3 | Nhập mã: `123456' OR 1=1--` | Không mở khóa được |

**Kết quả mong đợi:** Báo "Mã xác thực không đúng"

**Kết quả:** ✅ PASS / ❌ FAIL

---

## TC-SQL-05: Kiểm tra Database sau các test
| Bước | Hành động | Kết quả mong đợi |
|------|-----------|------------------|
| 1 | Mở Supabase Dashboard | - |
| 2 | Kiểm tra bảng `users` | - Bảng vẫn tồn tại<br>- Dữ liệu không bị thay đổi<br>- Không có record lạ |
| 3 | Kiểm tra các bảng khác | Tất cả tables nguyên vẹn |

**Kết quả:** ✅ PASS / ❌ FAIL

---

# 📝 BẢNG TỔNG HỢP KẾT QUẢ

| STT | Test Case | Kết quả | Ghi chú |
|-----|-----------|---------|---------|
| 1 | TC-01: Đăng nhập sai 1-4 lần | | |
| 2 | TC-02: Khóa tài khoản lần thứ 5 | | |
| 3 | TC-03: Nhập mã OTP đúng | | |
| 4 | TC-04: Nhập mã OTP sai | | |
| 5 | TC-05: Mã OTP hết hạn | | |
| 6 | TC-06: Gửi lại mã OTP | | |
| 7 | TC-07: Quay lại đăng nhập khi bị khóa | | |
| 8 | TC-08: Reset số lần sai | | |
| 9 | TC-SQL-01: SQL Injection Username | | |
| 10 | TC-SQL-02: SQL Injection Password | | |
| 11 | TC-SQL-03: SQL Injection Email | | |
| 12 | TC-SQL-04: SQL Injection Mã OTP | | |
| 13 | TC-SQL-05: Kiểm tra DB | | |

---

**Người thực hiện:** ____________________

**Ngày thực hiện:** ____________________

**Kết luận tổng thể:** ✅ Đạt / ❌ Không đạt
