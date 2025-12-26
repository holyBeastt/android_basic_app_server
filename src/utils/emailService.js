import nodemailer from 'nodemailer';
import logger from './logger.js';

// Tạo transporter với Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Kiểm tra kết nối khi khởi động
transporter.verify((error, success) => {
  if (error) {
    logger.error('Gmail SMTP connection failed:', error.message);
  } else {
    logger.info('Gmail SMTP ready');
  }
});

/**
 * Gửi email thông báo tài khoản bị khóa
 * @param {string} userEmail - Email người nhận
 * @param {string} username - Tên người dùng
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendAccountLockedEmail = async (userEmail, username) => {
  logger.debug('Sending account locked email');

  try {
    const info = await transporter.sendMail({
      from: {
        name: 'Quản Lý Khóa Học - Security Team',
        address: process.env.EMAIL_USER
      },
      to: userEmail,
      subject: '🔒 Cảnh báo:  Tài khoản bị khóa do nhập sai mật khẩu',
      html: `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Cảnh báo bảo mật</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
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
              border-radius:  12px;
              overflow: hidden;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 40px 30px;
              text-align:  center;
            }
            .header h1 {
              font-size: 28px;
              margin:  0;
              font-weight: 600;
            }
            .content {
              padding: 40px 30px;
            }
            .content h2 {
              color: #333;
              font-size: 22px;
              margin-bottom: 20px;
            }
            .danger-box {
              background-color: #fee;
              border-left: 4px solid #dc3545;
              padding: 20px;
              margin: 25px 0;
              border-radius: 6px;
            }
            . danger-box strong {
              color: #dc3545;
              font-size: 16px;
            }
            . info-box {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 25px 0;
            }
            .info-box strong {
              display: block;
              margin-bottom: 12px;
              color: #495057;
              font-size: 16px;
            }
            .info-box ul {
              list-style: none;
              padding: 0;
            }
            .info-box ul li {
              padding: 8px 0;
              border-bottom: 1px solid #e9ecef;
            }
            .info-box ul li:last-child {
              border-bottom: none;
            }
            .info-box ul li strong {
              display: inline;
              color: #495057;
              margin-right: 8px;
            }
            .section {
              margin: 30px 0;
            }
            .section h3 {
              color: #495057;
              font-size: 18px;
              margin-bottom:  15px;
            }
            .section p {
              margin:  10px 0;
              line-height: 1.8;
            }
            .section ul {
              margin: 15px 0;
              padding-left: 25px;
            }
            . section ul li {
              margin:  8px 0;
              line-height: 1.8;
            }
            .highlight {
              color: #667eea;
              font-weight: 600;
            }
            .footer {
              text-align: center;
              padding: 30px;
              margin-top:  20px;
              border-top:  2px solid #e9ecef;
              color: #6c757d;
              font-size: 13px;
            }
            .footer p {
              margin: 8px 0;
            }
            .footer strong {
              color: #495057;
            }
            @media only screen and (max-width: 600px) {
              .content {
                padding: 25px 20px;
              }
              .header {
                padding: 30px 20px;
              }
              .header h1 {
                font-size: 24px;
              }
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
                <strong>⚠️ Tài khoản của bạn đã bị khóa tạm thời 1 phút!</strong>
              </div>
              
              <p>
                Hệ thống phát hiện có người đã nhập sai mật khẩu <strong>3 lần liên tiếp</strong> 
                khi cố gắng đăng nhập vào tài khoản của bạn.
              </p>
              
              <div class="info-box">
                <strong>📋 Thông tin chi tiết:</strong>
                <ul>
                  <li>
                    <strong>Thời gian:</strong> 
                    ${new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })}
                  </li>
                  <li><strong>Email tài khoản:</strong> ${userEmail}</li>
                  <li><strong>Tên người dùng:</strong> ${username}</li>
                  <li><strong>Thời gian khóa:</strong> 1 phút (60 giây)</li>
                  <li><strong>Lý do: </strong> Nhập sai mật khẩu quá 3 lần</li>
                </ul>
              </div>

              <div class="section">
                <h3>❓ Điều này có phải do bạn? </h3>
                
                <p><strong>✅ Nếu ĐÚng là bạn:</strong></p>
                <ul>
                  <li>Vui lòng chờ <strong>1 phút</strong> rồi thử đăng nhập lại</li>
                  <li>Đảm bảo bạn nhớ đúng mật khẩu của mình</li>
                  <li>Kiểm tra xem phím Caps Lock có đang bật không</li>
                  <li>Có thể sử dụng tính năng <strong>"Quên mật khẩu"</strong> nếu cần thiết</li>
                </ul>

                <p style="margin-top: 20px;"><strong>❌ Nếu KHÔNG phải bạn:</strong></p>
                <ul>
                  <li>⚠️ <strong>Có người đang cố gắng truy cập trái phép vào tài khoản của bạn! </strong></li>
                  <li>🔐 Vui lòng <strong>đổi mật khẩu NGAY LẬP TỨC</strong> để bảo vệ tài khoản</li>
                  <li>📱 Bật xác thực 2 bước (2FA) nếu hệ thống hỗ trợ</li>
                  <li>📧 Kiểm tra và cập nhật email phục hồi của bạn</li>
                  <li>🔍 Xem lại các thiết bị đã đăng nhập vào tài khoản</li>
                </ul>
              </div>

              <div class="footer">
                <p><strong>Email này được gửi tự động từ hệ thống bảo mật</strong></p>
                <p><strong>Quản Lý Khóa Học - Android Basic App</strong></p>
                <p style="margin-top: 15px;">
                  Nếu bạn cần hỗ trợ, vui lòng liên hệ:  
                  <a href="mailto:${process.env.EMAIL_USER}" style="color: #667eea;">${process.env.EMAIL_USER}</a>
                </p>
                <p style="color: #999; margin-top: 20px;">
                  © ${new Date().getFullYear()} Android Basic App.  All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    });

    logger.debug('Email sent successfully');

    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error) {
    logger.error('Email send failed:', error.message);

    if (error.code === 'EAUTH') {
      logger.error('App Password invalid or expired');
    } else if (error.code === 'ECONNECTION') {
      logger.error('Cannot connect to Gmail SMTP');
    }

    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  sendAccountLockedEmail
};