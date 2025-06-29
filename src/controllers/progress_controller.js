// controllers/progress_controller.js
import supabase from "../config/supabase.js";

const saveProgress = async (req, res) => {
  const { lessonId, seconds } = req.body;
  const userId = req.user?.userId || 1; // Giả định userId = 1 nếu chưa có auth

  if (!lessonId || seconds == null) {
    return res.status(400).json({ error: "Thiếu dữ liệu" });
  }

  try {
    const { data: lesson, error: errLesson } = await supabase
      .from("lessons")
      .select("duration_sec")
      .eq("id", lessonId)
      .single();

    if (errLesson) throw errLesson;

    const duration = lesson?.duration_sec || 0;
    const percent =
      duration > 0 ? Math.min((seconds / duration) * 100, 100) : 0;

    const { error: errUpsert } = await supabase.from("progress").upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        last_watched: seconds,
        progress_percent: percent,
        last_accessed: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" }
    );

    if (errUpsert) throw errUpsert;

    return res.json({ success: true });
  } catch (error) {
    console.error("saveProgress error:", error);
    return res.status(500).json({ error: "Lỗi máy chủ" });
  }
};

const markCompleted = async (req, res) => {
  const { lessonId } = req.body;
  const userId = req.user?.userId || 1;

  if (!lessonId) {
    return res.status(400).json({ error: "Thiếu lessonId" });
  }

  try {
    const { error } = await supabase
      .from("progress")
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        progress_percent: 100,
      })
      .eq("user_id", userId)
      .eq("lesson_id", lessonId);

    if (error) throw error;

    return res.json({ success: true });
  } catch (error) {
    console.error("markCompleted error:", error);
    return res.status(500).json({ error: "Lỗi máy chủ" });
  }
};

const fetchCourseProgress = async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user?.userId || 1;

  try {
    const { data: lessons, error: errLessons } = await supabase
      .from("lessons")
      .select("id")
      .eq("course_id", courseId);

    if (errLessons) throw errLessons;

    const lessonIds = lessons.map((l) => l.id);

    const { data, error } = await supabase
      .from("progress")
      .select("lesson_id, is_completed")
      .eq("user_id", userId)
      .in("lesson_id", lessonIds);

    if (error) throw error;

    return res.json(data);
  } catch (error) {
    console.error("fetchCourseProgress error:", error);
    return res.status(500).json({ error: "Lỗi máy chủ" });
  }
};

export default {
  saveProgress,
  markCompleted,
  fetchCourseProgress,
};
