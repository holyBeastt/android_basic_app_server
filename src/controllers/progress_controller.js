// controllers/progress_controller.js
import supabase from "../config/supabase.js";

const saveProgress = async (req, res) => {
  const { lessonId, seconds, userId } = req.body;
  // const userId = req.user?.userId || 1; // Giả định userId = 1 nếu chưa có auth

  if (!lessonId || seconds == null) {
    return res.status(400).json({ error: "Thiếu dữ liệu" });
  }

  try {
    const { data: lesson, error: errLesson } = await supabase
      .from("lessons")
      .select("duration")
      .eq("id", lessonId)
      .single();

    if (errLesson) throw errLesson;

    const duration = lesson?.duration || 0;
    const percent =
      duration > 0 ? Math.min((seconds / duration) * 100, 100) : 0;

    const { error: errUpsert } = await supabase.from("progress").upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        last_watched_position: seconds,
        progress_percentage: percent,
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
  const { lessonId, userId } = req.body;
  // const userId = req.user?.userId;

  if (!lessonId) return res.status(400).json({ error: "Thiếu lessonId" });
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Upsert bảo đảm luôn có bản ghi
    const { error } = await supabase.from("progress").upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        is_completed: true,
        progress_percentage: 100,
        // completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" }
    );

    if (error) throw error;

    return res.json({ success: true });
  } catch (err) {
    console.error("markCompleted error:", err);
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

const getProgress = async (req, res) => {
  console.log("getProgress called");
  const lessonId = Number(req.params.lessonId); // ép kiểu số
  const userId = Number(req.headers["user-id"]); // lấy từ header

  if (!lessonId || !userId) {
    console.error("Missing lessonId or userId", { lessonId, userId });
    return res.status(400).json({ error: "Thiếu lessonId hoặc userId" });
  }

  console.log("params:", { lessonId, userId });

  try {
    const { data, error } = await supabase
      .from("progress")
      .select("last_watched_position")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .single();

    // Handle case when no progress record exists (PGRST116)
    if (error && error.code === 'PGRST116') {
      console.log("📝 No progress record found, creating new one...");
      
      // Create new progress record
      const { data: newProgress, error: createError } = await supabase
        .from("progress")
        .insert([{
          user_id: userId,
          lesson_id: lessonId,
          last_watched_position: 0,
          progress_percentage: 0,
          is_completed: false
        }])
        .select("last_watched_position")
        .single();
        
      if (createError) {
        console.error("❌ Error creating progress record:", createError);
        return res.json({ seconds: 0 }); // Fallback to default
      }
      
      console.log("✅ Created new progress record:", newProgress);
      return res.json({ seconds: newProgress.last_watched_position ?? 0 });
    }

    if (error) {
      console.error("❌ Database error:", error);
      throw error;
    }

    if (!data) {
      console.log("📝 No data returned, returning default position 0");
      return res.json({ seconds: 0 });
    }

    console.log("getProgress data:", data);

    return res.json({ seconds: data.last_watched_position ?? 0 });
  } catch (err) {
    console.error("getProgress error:", err);
    return res.status(500).json({ error: "Lỗi máy chủ" });
  }
};

const getAllProgressForUser = async (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ error: "Thiếu userId" });

  try {
    const { data, error } = await supabase
      .from("progress")
      .select("lesson_id, is_completed")
      .eq("user_id", userId);

    if (error) throw error;

    // Trả về dạng map để dễ dùng bên frontend
    const progressMap = {};
    data.forEach((p) => {
      progressMap[p.lesson_id] = p.is_completed;
    });

    return res.json(progressMap); // { 1: true, 2: false, ... }
  } catch (err) {
    console.error("getAllProgressForUser error:", err);
    return res.status(500).json({ error: "Lỗi máy chủ" });
  }
};

export default {
  saveProgress,
  markCompleted,
  fetchCourseProgress,
  getProgress,
  getAllProgressForUser,
};
