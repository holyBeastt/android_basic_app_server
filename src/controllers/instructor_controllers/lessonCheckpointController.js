// Controller cho lesson checkpoint (CRUD)
import db from '../../config/supabase.js';

// Lấy danh sách checkpoint theo lesson
const getCheckpointsByLesson = async (req, res) => {
  console.log('[Checkpoint] GET', req.query);
  const { lesson_id } = req.query;
  if (!lesson_id) return res.status(400).json({ error: 'lesson_id is required' });
  const { data, error } = await db
    .from('lesson_checkpoint')
    .select('*')
    .eq('lesson_id', lesson_id);
  if (error) {
    console.error('[Checkpoint][GET] Error:', error);
    return res.status(500).json({ error: error.message });
  }
  console.log('[Checkpoint][GET] Result:', data);
  res.json(data);
};

// Thêm checkpoint
const createCheckpoint = async (req, res) => {
  console.log('[Checkpoint] POST', req.body);
  const { lesson_id, time_in_video, quiz_id } = req.body;
  if (!lesson_id || !time_in_video || !quiz_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const { data, error } = await db
    .from('lesson_checkpoint')
    .insert([{ lesson_id, time_in_video, quiz_id }])
    .select();
  if (error) {
    console.error('[Checkpoint][POST] Error:', error);
    return res.status(500).json({ error: error.message });
  }
  console.log('[Checkpoint][POST] Created:', data[0]);
  res.status(201).json(data[0]);
};

// Sửa checkpoint
const updateCheckpoint = async (req, res) => {
  console.log('[Checkpoint] PUT', req.params, req.body);
  const { id } = req.params;
  const { time_in_video, quiz_id } = req.body;
  if (!id) return res.status(400).json({ error: 'id is required' });
  const { data, error } = await db
    .from('lesson_checkpoint')
    .update({ time_in_video, quiz_id })
    .eq('id', id)
    .select();
  if (error) {
    console.error('[Checkpoint][PUT] Error:', error);
    return res.status(500).json({ error: error.message });
  }
  console.log('[Checkpoint][PUT] Updated:', data[0]);
  res.json(data[0]);
};

// Xóa checkpoint
const deleteCheckpoint = async (req, res) => {
  console.log('[Checkpoint] DELETE', req.params);
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'id is required' });
  const { error } = await db
    .from('lesson_checkpoint')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('[Checkpoint][DELETE] Error:', error);
    return res.status(500).json({ error: error.message });
  }
  console.log('[Checkpoint][DELETE] Deleted id:', req.params.id);
  res.status(204).send();
};

export default {
  getCheckpointsByLesson,
  createCheckpoint,
  updateCheckpoint,
  deleteCheckpoint
};
