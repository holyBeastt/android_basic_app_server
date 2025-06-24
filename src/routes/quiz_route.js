// routes/quiz_routes.js
import express from "express";
import quizController from "../controllers/quiz_controller.js";

const router = express.Router();

router.get(
  "/api/v1/checkpoints/:lessonId",
  quizController.getCheckpointsByLesson
);
router.get("/api/v1/quiz/:quizId/questions", quizController.getQuizQuestions);

export default router;
