// routes/quiz_routes.js
import express from "express";
import quizController from "../controllers/quiz_controller.js";

const router = express.Router();

router.get(
  "/api/v1/checkpoints/:lessonId",
  quizController.getCheckpointsByLesson
);
router.get("/api/v1/quiz/:quizId/questions", quizController.getQuizQuestions);

// New API to check if quiz should be shown
router.get(
  "/api/v1/quiz/should-show/:lessonId/:userId",
  quizController.shouldShowQuiz
);

// Diagnosis API to check quiz health
router.get("/api/v1/quiz/:quizId/diagnose", quizController.diagnoseQuiz);

export default router;
