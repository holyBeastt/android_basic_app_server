import express from "express";
import courses_controller from "../controllers/courses_controller.js";

const router = express.Router();

router.get("/top-courses-list", courses_controller.getTopCoursesList);

export default router;
