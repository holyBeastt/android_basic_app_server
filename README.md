# 📱 flutter_basic_app

Ứng dụng học trực tuyến viết bằng Flutter, hỗ trợ người dùng đăng ký, đăng nhập, học tập qua video, làm quiz và tạo khóa học.

---

## 🚀 Chức năng chính

### 🔐 Người dùng
- Đăng ký tài khoản
- Đăng nhập hệ thống
- Tìm kiếm khóa học
- Mua khóa học
- Học bài (xem video, làm quiz)

### 🎓 Người tạo khóa học
- Tạo khóa học mới
- Thêm phần học (section) cho khóa học
- Thêm bài học (lesson) vào phần học
- Tải video bài học lên hệ thống
- Thêm checkpoint cho bài học (lesson_checkpoint)
- Tạo quiz cho bài học (quizzes, quiz_questions)

> ⚠️ Lưu ý: Trong hệ thống chỉ có một loại tài khoản. Người dùng có thể trở thành người tạo khóa học khi tạo khóa học đầu tiên.

---

## 🧩 Cấu trúc dữ liệu liên quan

### 1. `users`
- Lưu thông tin người dùng

### 2. `courses`
- Lưu thông tin khóa học
- Cột chính: `id`, `title`, `description`, `user_id`, `thumnail_url` - ảnh khóa học, `preview_video_url` - đường dẫn video xem trước của khóa học ...

### 3. `sections`
- Mỗi khóa học gồm nhiều phần học (sections)
- Cột chính: `id`, `course_id`, `title`, ...

### 4. `lessons`
- Mỗi phần học gồm nhiều bài học
- Cột chính: `id`, `section_id`, `title`, `video_url`, ...

### 5. Quiz liên quan:
- `lesson_checkpoint`: checkpoint trong bài học
- `quizzes`: quiz theo bài học
- `quiz_questions`: câu hỏi của quiz

---

## 🎥 Cách đặt tên video trong Supabase Storage

Khi tải video bài học lên Supabase, đặt tên theo định dạng sau để dễ quản lý:
- Tên: course*${course_id}; section*${section_id}; lesson_${lesson_id};
- `thumnail_url` - ảnh khóa học : Lưu ở trong course_${course_id} với tên `thumnail_url`;
`preview_video_url` - đường dẫn video xem trước của khóa học : Lưu ở trong course_${course_id} với tên `preview_video_url`
