import express from "express";
import courses_controller from "../controllers/courses_controller.js";

const router = express.Router();

router.get("/top-courses-list", courses_controller.getTopCoursesList);

// Lấy dữ liệu bài học của khóa học
router.get("/:id/sections", courses_controller.getCourseSectionsWithLessons);

// Lấy dữ liệu nhận xét
router.get("/:id/reviews", courses_controller.getReviews);

// Lấy thông tin giảng viên của khóa học
router.get("/:id/gv-info", courses_controller.getTeacherInfo);

export default router;
