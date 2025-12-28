import express from "express";
import courses_controller from "../controllers/courses_controller.js";
import auth_middleware from "../middleware/auth.middleware.js"

const router = express.Router();

// Route cho GIẢNG VIÊN xem video của khóa học mình sở hữu
router.get("/instructor/lessons/:lessonId/signed-url",
    auth_middleware.authenticateToken,
    auth_middleware.checkInstructorAccess,
    courses_controller.getSignedUrl);

router.get("/top-courses-list", courses_controller.getTopCoursesList);

// Lấy dữ liệu bài học của khóa học
router.get("/:id/sections", courses_controller.getCourseSectionsWithLessons);

// Lấy dữ liệu nhận xét
router.get("/:id/reviews", courses_controller.getReviews);

// Lấy thông tin giảng viên của khóa học
router.get("/:id/gv-info", courses_controller.getTeacherInfo);

// Lấy danh sách khóa học theo danh mục
router.get("/category/:category", courses_controller.getCourseWithCategory);

// Lấy danh sách khóa học theo từ khóa tìm kiếm
router.get("/search", courses_controller.getCourseWithSearch);

// Thêm nhận xét cho khóa học
router.post("/:id/reviews", auth_middleware.authenticateToken, courses_controller.addReview);

// Route cho user xem khóa học đã mua
router.get("/student/lessons/:lessonId/signed-url",
    auth_middleware.authenticateToken,
    auth_middleware.checkPaidStudentAccess,
    courses_controller.getSignedUrl);

export default router;
