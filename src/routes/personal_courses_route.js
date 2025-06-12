import express from "express";
import personal_courses_controller from "../controllers/personal_courses_controller.js";

const router = express.Router();

// Lấy dữ liệu khóa học sở hữu, khóa học đã mua
router.get(
  "/api/v1/personal-courses/:id/personal-courses-list",
  personal_courses_controller.getPersonalCourses
);

// Thêm khóa học

// Thêm video preview

// Thêm video của từng bài học

// Thêm bài kiểm tra

export default router;
