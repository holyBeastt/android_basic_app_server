// routes/progress_routes.js
import express from "express";
import progressController from "../controllers/progress_controller.js";

const router = express.Router();

router.post("/api/v1/save-progress", progressController.saveProgress);
router.post("/api/v1/progress/complete", progressController.markCompleted);
// router.get(
//   "/api/v1/progress/:courseId",
//   progressController.fetchCourseProgress
// );
router.get("/api/v1/progress/:lessonId", progressController.getProgress);

router.get(
  "/api/v1/progress-all/user/:userId",
  progressController.getAllProgressForUser
);

export default router;
