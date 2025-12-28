import logger from './logger.js';

// ===== CẤU HÌNH EMAIL - CHỈ DÙNG BREVO =====
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.EMAIL_USER;

if (!BREVO_API_KEY) {
  logger.error('❌ BREVO_API_KEY is not set in environment variables!');
}

if (!SENDER_EMAIL) {
  logger.error('❌ EMAIL_USER is not set in environment variables!');
}

logger.info('📧 Email Service initialized with Brevo API');

/**
 * Gửi email qua Brevo API
 */
const sendEmailViaBrevo = async (to, subject, htmlContent) => {
  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  logger.debug(`📧 Sending email to: ${to}`);
  
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { 
        name: 'Quản Lý Khóa Học', 
        email: SENDER_EMAIL 
      },
      to: [{ email: to }],
      subject: subject,
      htmlContent: htmlContent
    })
  });

  const responseData = await response.json();

  if (!response.ok) {
    logger.error('❌ Brevo API Error:', responseData);
    throw new Error(responseData.message || `Brevo API error: ${response.status}`);
  }

  logger.debug('📧 Brevo API Response:', responseData);
  return responseData;
};

/**
 * Gửi email thông báo tài khoản bị khóa
 */
export const sendAccountLockedEmail = async (userEmail, username) => {
  logger.info(`📧 Preparing to send locked email to: ${userEmail}`);

  const subject = '🔒 Cảnh báo: Tài khoản bị khóa do nhập sai mật khẩu';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cảnh báo bảo mật</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
          padding: 20px;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 { font-size: 28px; margin: 0; font-weight: 600; }
        .content { padding: 40px 30px; }
        .content h2 { color: #333; font-size: 22px; margin-bottom: 20px; }
        .danger-box {
          background-color: #fee;
          border-left: 4px solid #dc3545;
          padding: 20px;
          margin: 25px 0;
          border-radius: 6px;
        }
        .danger-box strong { color: #dc3545; font-size: 16px; }
        .info-box {
          background-color: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin: 25px 0;
        }
        .info-box strong { display: block; margin-bottom: 12px; color: #495057; font-size: 16px; }
        .info-box ul { list-style: none; padding: 0; }
        .info-box ul li { padding: 8px 0; border-bottom: 1px solid #e9ecef; }
        .info-box ul li:last-child { border-bottom: none; }
        .highlight { color: #667eea; font-weight: 600; }
        .footer {
          text-align: center;
          padding: 30px;
          margin-top: 20px;
          border-top: 2px solid #e9ecef;
          color: #6c757d;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>🔒 Cảnh Báo Bảo Mật</h1>
        </div>
        
        <div class="content">
          <h2>Xin chào <span class="highlight">${username}</span>,</h2>
          
          <div class="danger-box">
            <strong>⚠️ Tài khoản của bạn đã bị khóa tạm thời 10 phút!</strong>
          </div>
          
          <p>
            Hệ thống phát hiện có người đã nhập sai mật khẩu <strong>3 lần liên tiếp</strong> 
            khi cố gắng đăng nhập vào tài khoản của bạn.
          </p>
          
          <div class="info-box">
            <strong>📋 Thông tin chi tiết:</strong>
            <ul>
              <li><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</li>
              <li><strong>Email tài khoản:</strong> ${userEmail}</li>
              <li><strong>Thời gian khóa:</strong> 10 phút (600 giây)</li>
              <li><strong>Lý do:</strong> Nhập sai mật khẩu quá 3 lần</li>
            </ul>
          </div>

          <div class="footer">
            <p><strong>Email này được gửi tự động từ hệ thống bảo mật</strong></p>
            <p><strong>Quản Lý Khóa Học - Android Basic App</strong></p>
            <p style="color: #999; margin-top: 20px;">
              © ${new Date().getFullYear()} Android Basic App. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmailViaBrevo(userEmail, subject, htmlContent);
    logger.info(`✅ Email sent successfully to ${userEmail}`);
    return { success: true, messageId: result.messageId };

  } catch (error) {
    logger.error(`❌ Email send failed to ${userEmail}:`, error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  sendAccountLockedEmail
};