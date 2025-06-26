import express from 'express';
import enrollment_controller from '../controllers/enrollment_controller.js';
const router = express.Router();
// Đăng ký khóa học
router.post('/:courseId/enroll', enrollment_controller.enrollCourse);
//Check xem người dùng đã đăng ký khóa học chưa
router.get('/:courseId/check-enrollment', enrollment_controller.checkEnrolled);

// Lấy danh sách khóa học đã đăng ký của người dùng
// router.get('/user/:userId/enrollments', enrollment_controller.getEnrollments);
// // Hủy đăng ký khóa học
// router.delete('/:courseId/unenroll', enrollment_controller.unenrollCourse);
export default router;