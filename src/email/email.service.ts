import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService implements OnModuleInit {
    private readonly logger = new Logger(EmailService.name);

    onModuleInit() {
        const apiKey = process.env.SENDGRID_API_KEY;

        if (!apiKey) {
            throw new Error('SENDGRID_API_KEY environment variable is not set');
        }

        if (!process.env.FROM_EMAIL) {
            throw new Error('FROM_EMAIL environment variable is not set');
        }

        if (!process.env.FROM_NAME) {
            throw new Error('FROM_NAME environment variable is not set');
        }

        sgMail.setApiKey(apiKey);
        this.logger.log('SendGrid email service initialized successfully');
    }

    async sendWelcomeEmail(
        email: string,
        name: string,
        password: string,
        memberId: string,
    ): Promise<boolean> {
        // Validate inputs
        if (!email || !name || !password || !memberId) {
            this.logger.error('Missing required parameters for welcome email');
            return false;
        }

        const msg = {
            to: email,
            from: {
                email: process.env.FROM_EMAIL!,
                name: process.env.FROM_NAME!,
            },
            subject: 'Welcome to GreenDoors Association - Your Account Details',
            html: this.getWelcomeEmailTemplate(name, email, password, memberId),
            text: this.getWelcomeEmailText(name, email, password, memberId),
        };

        try {
            await sgMail.send(msg);
            this.logger.log(`Welcome email sent successfully to ${email}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send welcome email to ${email}:`, error.response?.body || error);
            return false;
        }
    }

    private getWelcomeEmailTemplate(
        name: string,
        email: string,
        password: string,
        memberId: string,
    ): string {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to GreenDoors Association</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background-color: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 300;
          }
          .content { 
            padding: 30px; 
          }
          .credentials { 
            background-color: #f1f8e9; 
            padding: 20px; 
            border-left: 4px solid #4CAF50; 
            margin: 25px 0;
            border-radius: 5px;
          }
          .credentials h3 {
            margin-top: 0;
            color: #4CAF50;
          }
          .credential-item {
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .credential-item:last-child {
            border-bottom: none;
          }
          .credential-label {
            font-weight: 600;
            color: #555;
            display: inline-block;
            width: 140px;
          }
          .credential-value {
            color: #333;
            font-family: 'Courier New', monospace;
            background-color: #fff;
            padding: 4px 8px;
            border-radius: 3px;
            border: 1px solid #ddd;
          }
          .warning { 
            background-color: #fff8e1; 
            border-left: 4px solid #ffa726; 
            padding: 20px; 
            margin: 25px 0;
            border-radius: 5px;
          }
          .warning h4 {
            margin-top: 0;
            color: #f57c00;
          }
          .footer { 
            text-align: center; 
            padding: 30px 20px; 
            background-color: #f8f9fa;
            color: #666; 
            font-size: 14px;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 25px;
            margin: 20px 0;
            font-weight: 600;
          }
          .date {
            color: #999;
            font-size: 12px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌿 Welcome to GreenDoors Association!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your membership has been successfully created</p>
          </div>
          
          <div class="content">
            <h2 style="color: #4CAF50; margin-top: 0;">Hello ${name},</h2>
            <p>Congratulations! Your membership with <strong>GreenDoors Association</strong> has been successfully created. We're excited to have you as part of our  community.</p>
            
            <div class="credentials">
              <h3>🔐 Your Login Credentials</h3>
              <div class="credential-item">
                <span class="credential-label">Member ID:</span>
                <span class="credential-value">${memberId}</span>
              </div>
              <div class="credential-item">
                <span class="credential-label">Email:</span>
                <span class="credential-value">${email}</span>
              </div>
              <div class="credential-item">
                <span class="credential-label">Password:</span>
                <span class="credential-value">${password}</span>
              </div>
            </div>
            
            <div class="warning">
              <h4>🛡️ Important Security Notice</h4>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Change your password</strong> immediately after your first login</li>
                <li><strong>Keep your credentials secure</strong> and never share them with anyone</li>
                <li><strong>Use a strong password</strong> with a mix of letters, numbers, and symbols</li>
                <li><strong>Log out completely</strong> when using shared devices</li>
              </ul>
            </div>
            
            <p>You can now access your member portal using the credentials provided above. If you have any questions or need assistance, please don't hesitate to contact our support team at <strong>support@greendoors.org</strong>.</p>
            
            <div style="text-align: center;">
              <a href="http://localhost:3000/login" class="button">Login to Your Account</a>
            </div>
            
            <p><strong>Welcome to our green community!</strong> Together, we're making a difference for our planet. 🌍</p>
            
            <div class="date">
              Account created on: ${new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        })} (UTC)
            </div>
          </div>
          
          <div class="footer">
            <p><strong>🌿 GreenDoors Association</strong></p>
            <p>Building a sustainable future, one member at a time.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
            <p style="margin-top: 15px; font-size: 12px;">© 2025 GreenDoors Association. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    }

    private getWelcomeEmailText(
        name: string,
        email: string,
        password: string,
        memberId: string,
    ): string {
        return `
Welcome to GreenDoors Association!

Hello ${name},

Congratulations! Your membership has been successfully created.

Your Login Credentials:
- Member ID: ${memberId}
- Email: ${email}
- Password: ${password}

IMPORTANT SECURITY NOTICE:
- Change your password immediately after your first login
- Keep your credentials secure and never share them
- Use a strong password with letters, numbers, and symbols
- Log out completely when using shared devices


If you have any questions, please contact our support team at support@greendoors.org

Welcome to our green community! Together, we're making a difference for our planet.

Account created on: ${new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        })} (UTC)

---
GreenDoors Association
Building a sustainable future, one member at a time.

This is an automated message. Please do not reply to this email.
© 2024 GreenDoors Association. All rights reserved.
    `;
    }
}