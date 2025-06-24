// controllers/quiz_controller.js
import supabase from "../config/supabase.js";

// Lấy các quiz checkpoint cho một bài học (lesson)
const getCheckpointsByLesson = async (req, res) => {
  console.log("hehe");
  const { lessonId } = req.params;
  try {
    const { data, error } = await supabase
      .from("lesson_checkpoint")
      .select("time_in_video, quiz_id")
      .eq("lesson_id", lessonId)
      .order("time_in_video", { ascending: true });

    console.log("gà 1");
    if (error) {
      console.error("Lỗi Supabase (checkpoints):", error);
      return res.status(500).json({ error: error.message });
    }

    console.log("time = ", data);

    res.status(200).json(data);
  } catch (err) {
    console.error("Lỗi server:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
};

// Lấy các câu hỏi của một quiz
const getQuizQuestions = async (req, res) => {
  const { quizId } = req.params;
  try {
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("question_text, options, correct_option, explanation")
      .eq("quiz_id", quizId)
      .order("order_index", { ascending: true });

    if (error) {
      console.error("Lỗi Supabase (quiz questions):", error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("Lỗi server:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
};

export default {
  getCheckpointsByLesson,
  getQuizQuestions,
};
