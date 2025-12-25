// routes/instructor/instructorRoutes.js
import express from "express";
import { instructorAuth } from "../../middleware/instructorAuth.middleware.js";
import { simpleTestAuth } from "../../middleware/simpleTestAuth.middleware.js";
import courseController from "../../controllers/instructor_controllers/courseController.js";
import sectionController from "../../controllers/instructor_controllers/sectionController.js";
import lessonController from "../../controllers/instructor_controllers/lessonController.js";
import quizController from "../../controllers/instructor_controllers/quizController.js";
import questionController from "../../controllers/instructor_controllers/questionController.js";
import lessonCheckpointController from "../../controllers/instructor_controllers/lessonCheckpointController.js";

const router = express.Router();

// Use simple test auth for easier testing (change to instructorAuth for production)
router.use(process.env.NODE_ENV === 'test' ? simpleTestAuth : simpleTestAuth);

// Course routes
router.get("/courses", courseController.list);
router.get("/courses/revenue-stats", courseController.getRevenueStats);
router.get("/courses/:courseId", courseController.getOne);
router.post("/courses", courseController.create);
router.put("/courses/:courseId", courseController.update);
router.delete("/courses/:courseId", courseController.remove);

// Section routes
router.post("/courses/:courseId/sections", sectionController.create);
router.put("/sections/:sectionId", sectionController.update);
router.delete("/sections/:sectionId", sectionController.remove);

// Lesson routes
router.post("/sections/:sectionId/lessons", lessonController.create);
router.put("/lessons/:lessonId", lessonController.update);
router.delete("/lessons/:lessonId", lessonController.remove);

// Quiz routes
router.post("/lessons/:lessonId/quizzes", (req, res, next) => {
  console.log("🚀 POST /lessons/:lessonId/quizzes - Create Quiz Request");
  console.log("📊 Request details:", {
    lessonId: req.params.lessonId,
    body: req.body,
    user: req.user?.id || 'Unknown',
    timestamp: new Date().toISOString()
  });
  next();
}, quizController.create);

router.put("/quizzes/:quizId", (req, res, next) => {
  console.log("🔄 PUT /quizzes/:quizId - Update Quiz Request");
  console.log("📊 Request details:", {
    quizId: req.params.quizId,
    body: req.body,
    user: req.user?.id || 'Unknown',
    timestamp: new Date().toISOString()
  });
  next();
}, quizController.update);

router.delete("/quizzes/:quizId", (req, res, next) => {
  console.log("🗑️ DELETE /quizzes/:quizId - Delete Quiz Request");
  console.log("📊 Request details:", {
    quizId: req.params.quizId,
    user: req.user?.id || 'Unknown',
    timestamp: new Date().toISOString()
  });
  next();
}, quizController.remove);

// Question routes
router.post("/quizzes/:quizId/questions", (req, res, next) => {
  console.log("❓ POST /quizzes/:quizId/questions - Create Question Request");
  console.log("📊 Request details:", {
    quizId: req.params.quizId,
    body: req.body,
    user: req.user?.id || 'Unknown',
    timestamp: new Date().toISOString()
  });
  next();
}, questionController.create);

router.put("/questions/:questionId", (req, res, next) => {
  console.log("🔄 PUT /questions/:questionId - Update Question Request");
  console.log("📊 Request details:", {
    questionId: req.params.questionId,
    body: req.body,
    user: req.user?.id || 'Unknown',
    timestamp: new Date().toISOString()
  });
  next();
}, questionController.update);

router.delete("/questions/:questionId", (req, res, next) => {
  console.log("🗑️ DELETE /questions/:questionId - Delete Question Request");
  console.log("📊 Request details:", {
    questionId: req.params.questionId,
    user: req.user?.id || 'Unknown',
    timestamp: new Date().toISOString()
  });
  next();
}, questionController.remove);

// Lesson Checkpoint routes
router.get("/lesson-checkpoints", lessonCheckpointController.getCheckpointsByLesson);
router.post("/lesson-checkpoints", lessonCheckpointController.createCheckpoint);
router.put("/lesson-checkpoints/:id", lessonCheckpointController.updateCheckpoint);
router.delete("/lesson-checkpoints/:id", lessonCheckpointController.deleteCheckpoint);

// ========================================
// REACT-ADMIN COMPATIBLE ROUTES
// ========================================

// Sections as independent resource
router.get("/sections", sectionController.list);           // ?course_id=123
router.get("/sections/:sectionId", sectionController.getOne);
// Keep existing nested routes for backward compatibility

// Lessons as independent resource  
router.get("/lessons", lessonController.list);             // ?section_id=456
// Signed URL for lesson video
router.get("/lessons/:lessonId", lessonController.getOne);

// Quizzes as independent resource
router.get("/quizzes", quizController.list);               // ?lesson_id=789
router.get("/quizzes/:quizId", quizController.getOne);

// Questions as independent resource
router.get("/questions", questionController.list);         // ?quiz_id=101
router.get("/questions/:questionId", questionController.getOne);

export default router;
