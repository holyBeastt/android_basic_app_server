// controllers/quiz_controller.js
import supabase from "../config/supabase.js";

// Lấy các quiz checkpoint cho một bài học (lesson)
const getCheckpointsByLesson = async (req, res) => {
  const { lessonId } = req.params;
  console.log("🎯 getCheckpointsByLesson called for lessonId:", lessonId);
  
  try {
    const { data, error } = await supabase
      .from("lesson_checkpoint")
      .select("time_in_video, quiz_id")
      .eq("lesson_id", lessonId)
      .order("time_in_video", { ascending: true });

    if (error) {
      console.error("❌ Lỗi Supabase (checkpoints):", error);
      return res.status(500).json({ error: error.message });
    }

    console.log("📊 Quiz checkpoints found:", data);
    console.log("📊 Total checkpoints:", data?.length || 0);
    
    // Validate checkpoints
    if (data && data.length > 0) {
      const uniqueQuizIds = [...new Set(data.map(cp => cp.quiz_id))];
      console.log("🎯 Unique quiz IDs:", uniqueQuizIds);
      
      if (uniqueQuizIds.length === 1 && data.length > 1) {
        console.warn("⚠️ Multiple checkpoints with same quiz_id - this might be intentional");
      }
      
      // Check for reasonable time intervals
      const timeGaps = [];
      for (let i = 1; i < data.length; i++) {
        timeGaps.push(data[i].time_in_video - data[i-1].time_in_video);
      }
      console.log("⏱️ Time gaps between checkpoints:", timeGaps);
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("❌ Lỗi server:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
};

// Lấy các câu hỏi của một quiz
const getQuizQuestions = async (req, res) => {
  const { quizId } = req.params;
  console.log("📝 getQuizQuestions called for quizId:", quizId);
  
  if (!quizId || isNaN(quizId)) {
    console.error("❌ Invalid quizId:", quizId);
    return res.status(400).json({ error: "Invalid quiz ID" });
  }
  
  try {
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("id, question_text, options, correct_option, explanation, order_index")
      .eq("quiz_id", quizId)
      .order("order_index", { ascending: true });

    if (error) {
      console.error("❌ Lỗi Supabase (quiz questions):", error);
      return res.status(500).json({ error: error.message });
    }

    console.log("📊 Quiz questions found:", data?.length || 0);
    
    // Detailed validation for null/empty values
    if (data && data.length > 0) {
      console.log("🔍 Detailed questions analysis:");
      
      data.forEach((question, index) => {
        console.log(`📝 Question ${index + 1}:`, {
          id: question.id,
          question_text: question.question_text ? `"${question.question_text.substring(0, 50)}..."` : "❌ NULL/EMPTY",
          options: question.options ? `${Object.keys(question.options).length} options` : "❌ NULL/EMPTY",
          correct_option: question.correct_option || "❌ NULL/EMPTY",
          explanation: question.explanation !== null ? (question.explanation || "Empty string") : "❌ NULL",
          order_index: question.order_index ?? "❌ NULL"
        });
        
        // Check for critical null values
        const issues = [];
        if (!question.question_text || question.question_text.trim() === '') {
          issues.push("question_text is null/empty");
        }
        if (!question.options || Object.keys(question.options).length === 0) {
          issues.push("options is null/empty");
        }
        if (!question.correct_option) {
          issues.push("correct_option is null/empty");
        }
        
        if (issues.length > 0) {
          console.warn(`⚠️ Question ${index + 1} issues:`, issues);
        }
      });
      
      // Summary
      const nullQuestionTexts = data.filter(q => !q.question_text || q.question_text.trim() === '').length;
      const nullOptions = data.filter(q => !q.options || Object.keys(q.options).length === 0).length;
      const nullCorrectOptions = data.filter(q => !q.correct_option).length;
      
      console.log("📊 Summary:", {
        totalQuestions: data.length,
        questionsWithNullText: nullQuestionTexts,
        questionsWithNullOptions: nullOptions,
        questionsWithNullCorrectOption: nullCorrectOptions
      });
      
      if (nullQuestionTexts > 0 || nullOptions > 0 || nullCorrectOptions > 0) {
        console.error("🚨 CRITICAL: Found questions with null/empty critical fields!");
      }
      
    } else {
      console.warn("⚠️ No questions found for quiz ID:", quizId);
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("❌ Lỗi server:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
};

// Check if quiz should be shown based on user progress
const shouldShowQuiz = async (req, res) => {
  const { lessonId, userId } = req.params;
  const { currentTime } = req.query; // Current video time in seconds
  
  console.log("🎯 shouldShowQuiz called:", {
    lessonId: Number(lessonId),
    userId: Number(userId),
    currentTime: Number(currentTime)
  });

  try {
    // Get all quiz checkpoints for this lesson
    const { data: checkpoints, error: checkpointError } = await supabase
      .from("lesson_checkpoint")
      .select("time_in_video, quiz_id")
      .eq("lesson_id", lessonId)
      .order("time_in_video", { ascending: true });

    if (checkpointError) {
      console.error("❌ Error getting checkpoints:", checkpointError);
      return res.status(500).json({ error: checkpointError.message });
    }

    console.log("📊 All checkpoints:", checkpoints);

    // Find quizzes that should be triggered at current time
    const currentTimeNum = Number(currentTime);
    const triggeredQuizzes = checkpoints.filter(cp => 
      currentTimeNum >= cp.time_in_video && 
      currentTimeNum < (cp.time_in_video + 10) // 10 second window
    );

    console.log("🎯 Triggered quizzes:", triggeredQuizzes);

    res.status(200).json({
      shouldShow: triggeredQuizzes.length > 0,
      quizzes: triggeredQuizzes,
      currentTime: currentTimeNum,
      nextQuiz: checkpoints.find(cp => cp.time_in_video > currentTimeNum)
    });

  } catch (err) {
    console.error("❌ shouldShowQuiz error:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
};

// Test API to diagnose quiz issues
const diagnoseQuiz = async (req, res) => {
  const { quizId } = req.params;
  console.log("🔍 diagnoseQuiz called for quizId:", quizId);
  
  try {
    // 1. Check if quiz exists
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, title, description, lesson_id, created_at")
      .eq("id", quizId)
      .single();
      
    if (quizError) {
      console.log("❌ Quiz not found:", quizError);
      return res.status(404).json({ error: "Quiz not found", details: quizError });
    }
    
    console.log("✅ Quiz found:", quiz);
    
    // 2. Check questions
    const { data: questions, error: questionError } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("quiz_id", quizId)
      .order("order_index", { ascending: true });
      
    if (questionError) {
      console.log("❌ Error getting questions:", questionError);
      return res.status(500).json({ error: "Error getting questions", details: questionError });
    }
    
    console.log(`📝 Found ${questions?.length || 0} questions`);
    
    // 3. Check lesson checkpoints
    const { data: checkpoints, error: checkpointError } = await supabase
      .from("lesson_checkpoint")
      .select("*")
      .eq("quiz_id", quizId);
      
    console.log(`🎯 Found ${checkpoints?.length || 0} checkpoints for this quiz`);
    
    // 4. Analyze data quality
    const analysis = {
      quiz: {
        exists: !!quiz,
        hasTitle: !!(quiz?.title && quiz.title.trim()),
        hasDescription: !!(quiz?.description && quiz.description.trim()),
        lessonId: quiz?.lesson_id
      },
      questions: {
        count: questions?.length || 0,
        issues: []
      },
      checkpoints: {
        count: checkpoints?.length || 0,
        timePoints: checkpoints?.map(cp => cp.time_in_video) || []
      }
    };
    
    // Analyze each question
    if (questions && questions.length > 0) {
      questions.forEach((q, index) => {
        const questionIssues = [];
        if (!q.question_text || q.question_text.trim() === '') questionIssues.push('Empty question text');
        if (!q.options || Object.keys(q.options).length === 0) questionIssues.push('No options');
        if (!q.correct_option) questionIssues.push('No correct option');
        
        if (questionIssues.length > 0) {
          analysis.questions.issues.push({
            questionIndex: index + 1,
            questionId: q.id,
            issues: questionIssues
          });
        }
      });
    }
    
    res.status(200).json({
      quiz,
      questions,
      checkpoints,
      analysis,
      recommendation: analysis.questions.issues.length > 0 ? 
        "Fix question issues before using this quiz" : 
        "Quiz looks good to use"
    });
    
  } catch (err) {
    console.error("❌ diagnoseQuiz error:", err);
    res.status(500).json({ error: "Diagnosis failed", details: err.message });
  }
};

export default {
  getCheckpointsByLesson,
  getQuizQuestions,
  shouldShowQuiz,
  diagnoseQuiz,
};
