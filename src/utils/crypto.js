import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Cấu hình thuật toán
const algorithm = 'aes-256-cbc';

// Lấy key từ file .env
// Key PHẢI dài đúng 32 ký tự (bytes) cho aes-256
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

// 1. HÀM MÃ HÓA (Dùng khi Lưu vào DB)
export const encryptData = (text) => {
    if (!text) return null;

    try {
        // Chuyển text sang string phòng trường hợp đầu vào là số
        const textString = String(text);

        // Tạo IV ngẫu nhiên (16 bytes) cho mỗi lần mã hóa
        // Điều này giúp cùng 1 nội dung nhưng mỗi lần mã hóa ra chuỗi khác nhau -> Rất bảo mật
        const iv = crypto.randomBytes(16);

        // Tạo Cipher
        const cipher = crypto.createCipheriv(algorithm, key, iv);

        // Bắt đầu mã hóa
        let encrypted = cipher.update(textString, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Trả về format: "IV:Nội_dung_đã_mã_hóa"
        // Phải lưu cả IV thì lúc giải mã mới biết đường mà dịch lại
        return `${iv.toString('hex')}:${encrypted}`;

    } catch (error) {
        console.error("Lỗi mã hóa:", error);
        return null; // Trả về null nếu lỗi để tránh lưu rác vào DB
    }
};

// 2. HÀM GIẢI MÃ (Dùng khi lấy ra hiển thị)
export const decryptData = (text) => {
    if (!text) return null;

    // --- LOGIC MIGRATION (Tương thích ngược) ---
    // Nếu chuỗi không chứa dấu ':', tức là dữ liệu cũ chưa mã hóa -> Trả về luôn
    if (!text.includes(':')) {
        return text;
    }
    // ------------------------------------------

    try {
        const parts = text.split(':');

        // Kiểm tra format có đúng 2 phần không
        if (parts.length !== 2) return text;

        const iv = Buffer.from(parts[0], 'hex');
        const encryptedContent = parts[1];

        const decipher = crypto.createDecipheriv(algorithm, key, iv);

        let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;

    } catch (error) {
        // Nếu key sai hoặc dữ liệu lỗi -> Trả về text gốc để không crash app
        // console.error("Lỗi giải mã:", error);
        return text;
    }
};