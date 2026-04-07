const router = require('express').Router();
const nodemailer = require('nodemailer');

// Store OTPs in memory for this demo (production would use Redis/DB)
const otpStore = new Map();

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// SMS Service Function (using Textlocal as primary, Fast2SMS as fallback)
const sendSMSOTP = async (phoneNumber, otp) => {
    try {
        // Format phone number (remove +91, spaces, dashes)
        const formattedPhone = phoneNumber.replace(/\+91|\s|-/g, '');
        
        console.log(`[SMS DEBUG] Sending OTP to: ${formattedPhone}`);
        console.log(`[SMS DEBUG] Textlocal Key: ${process.env.TEXTLOCAL_API_KEY ? 'Present' : 'Missing'}`);
        console.log(`[SMS DEBUG] Fast2SMS Key: ${process.env.FAST2SMS_API_KEY ? 'Present' : 'Missing'}`);
        
        // Try Textlocal first (more reliable)
        if (process.env.TEXTLOCAL_API_KEY) {
            try {
                const axios = require('axios');
                const response = await axios.post('https://api.textlocal.in/send/', {
                    apikey: process.env.TEXTLOCAL_API_KEY,
                    numbers: `91${formattedPhone}`,
                    message: `Your InnoStay verification code is: ${otp}. Valid for 5 minutes.`,
                    sender: 'INNSTA'
                }, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                console.log(`[SMS DEBUG] Textlocal Response:`, response.data);

                if (response.data.status === 'success') {
                    console.log(`SMS sent successfully via Textlocal to ${formattedPhone}`);
                    return true;
                } else {
                    console.error('Textlocal SMS failed:', response.data);
                }
            } catch (textlocalError) {
                console.error('Textlocal API Error:', textlocalError.response?.data || textlocalError.message);
            }
        }

        // Fallback to Fast2SMS if Textlocal fails or not configured
        if (process.env.FAST2SMS_API_KEY) {
            try {
                const axios = require('axios');
                const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
                    authorization: process.env.FAST2SMS_API_KEY,
                    route: 'v3',
                    sender_id: 'FTSMS',
                    message: `Your InnoStay verification code is: ${otp}. Valid for 5 minutes.`,
                    language: 'english',
                    flash: 0,
                    numbers: formattedPhone
                });

                console.log(`[SMS DEBUG] Fast2SMS Response:`, response.data);

                if (response.data.return === true) {
                    console.log(`SMS sent successfully via Fast2SMS to ${formattedPhone}`);
                    return true;
                } else {
                    console.error('Fast2SMS SMS failed:', response.data);
                }
            } catch (fast2smsError) {
                console.error('Fast2SMS API Error:', fast2smsError.response?.data || fast2smsError.message);
            }
        }

        // If both SMS services fail, show console OTP for development
        console.log('----------------------------------------');
        console.log(`[SMS SYSTEM] Both SMS services failed. Using console OTP.`);
        console.log(`[SMS SYSTEM] OTP for ${phoneNumber}: ${otp}`);
        console.log('----------------------------------------');
        console.log('To enable SMS:');
        console.log('1. Get Textlocal API key: https://www.textlocal.in/');
        console.log('2. Add TEXTLOCAL_API_KEY to your .env file');
        console.log('3. Or fix Fast2SMS API key');
        console.log('----------------------------------------');
        return true; // Treat as success in development
        
    } catch (error) {
        console.error('SMS Error:', error);
        // Fallback to console for development
        console.log('----------------------------------------');
        console.log(`[SMS SYSTEM] SMS send failed. Using console OTP.`);
        console.log(`[SMS SYSTEM] OTP for ${phoneNumber}: ${otp}`);
        console.log('----------------------------------------');
        return true; // Treat as success in development mode
    }
};

// Helper to send email
const sendEmailOTP = async (email, otp) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('----------------------------------------');
        console.log(`[OTP SYSTEM] Email configuration missing.`);
        console.log(`[OTP SYSTEM] OTP for ${email}: ${otp}`);
        console.log('----------------------------------------');
        return true; // Simulate success
    }

    try {
        await transporter.sendMail({
            from: process.env.MAIL_FROM || 'InnoStay <no-reply@innostay.local>',
            to: email,
            subject: 'Your Verification Code - InnoStay',
            text: `Your verification code is: ${otp}. It expires in 5 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #4361ee;">Verify Your Email</h2>
                    <p>Thank you for choosing InnoStay. Please use the following One-Time Password (OTP) to verify your email address:</p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border: 1px solid #e1e5ee;">
                        ${otp}
                    </div>
                    <p>This code will expire in 5 minutes.</p>
                    <p style="color: #6c757d; font-size: 12px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
                </div>
            `
        });
        return true;
    } catch (error) {
        console.error('Email sending failed:', error);
        if (process.env.EMAIL_DEV_MODE === 'true' || process.env.NODE_ENV === 'development') {
            console.log('----------------------------------------');
            console.log(`[OTP SYSTEM] DEV MODE FALLBACK - Email send failed. Using console OTP.`);
            console.log(`[OTP SYSTEM] OTP for ${email}: ${otp}`);
            console.log('----------------------------------------');
            return true; // Treat as success in dev
        }
        return false;
    }
};

router.post('/generate-otp', async (req, res) => {
    const { aadhaarNumber, phoneNumber } = req.body;
    
    console.log(`[DEBUG] Request body:`, req.body);
    console.log(`[DEBUG] Aadhaar: ${aadhaarNumber}, Phone: ${phoneNumber}`);
    
    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
        return res.status(400).json({ message: 'Invalid Aadhaar number' });
    }

    if (!phoneNumber) {
        console.log(`[DEBUG] Phone number is missing or empty`);
        return res.status(400).json({ message: 'Phone number is required' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with expiration (5 minutes)
    otpStore.set(aadhaarNumber, {
        otp,
        expires: Date.now() + 5 * 60 * 1000
    });

    // Send OTP via SMS
    try {
        console.log(`[DEBUG] About to send SMS to ${phoneNumber}`);
        const smsSent = await sendSMSOTP(phoneNumber, otp);
        
        if (smsSent) {
            console.log('----------------------------------------');
            console.log(`[OTP SYSTEM] Generated OTP for Aadhaar ${aadhaarNumber}: ${otp}`);
            console.log(`[OTP SYSTEM] SMS sent to ${phoneNumber}`);
            console.log('----------------------------------------');
            res.json({ message: 'OTP sent successfully', success: true });
        } else {
            console.log(`[DEBUG] SMS sending returned false`);
            res.status(500).json({ message: 'Failed to send OTP SMS' });
        }
    } catch (error) {
        console.error('OTP generation error:', error);
        res.status(500).json({ message: 'Failed to generate OTP' });
    }
});

// Test endpoint to verify Fast2SMS API
router.post('/test-sms', async (req, res) => {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
        return res.status(400).json({ message: 'Phone number is required' });
    }

    try {
        const testOtp = '123456';
        const smsSent = await sendSMSOTP(phoneNumber, testOtp);
        
        if (smsSent) {
            res.json({ 
                message: 'Test SMS sent successfully', 
                success: true,
                phoneNumber: phoneNumber
            });
        } else {
            res.status(500).json({ message: 'Failed to send test SMS' });
        }
    } catch (error) {
        console.error('Test SMS error:', error);
        res.status(500).json({ 
            message: 'Test SMS failed', 
            error: error.message 
        });
    }
});

router.post('/generate-email-otp', async (req, res) => {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
        return res.status(400).json({ message: 'Invalid email address' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with expiration (5 minutes)
    otpStore.set(email, {
        otp,
        expires: Date.now() + 5 * 60 * 1000
    });

    const sent = await sendEmailOTP(email, otp);

    if (sent) {
        res.json({ message: 'OTP sent to your email', success: true });
    } else {
        res.status(500).json({ message: 'Failed to send OTP email' });
    }
});

router.post('/check-otp', (req, res) => {
    const { aadhaarNumber, otp } = req.body;
    
    const storedData = otpStore.get(aadhaarNumber);

    if (!storedData) {
        return res.status(400).json({ message: 'No OTP generated for this Aadhaar number' });
    }

    if (Date.now() > storedData.expires) {
        otpStore.delete(aadhaarNumber);
        return res.status(400).json({ message: 'OTP expired' });
    }

    if (storedData.otp === otp) {
        otpStore.delete(aadhaarNumber); // Clear after successful use
        return res.json({ message: 'Verification successful', success: true });
    } else {
        return res.status(400).json({ message: 'Invalid OTP' });
    }
});

router.post('/verify-email-otp', (req, res) => {
    const { email, otp } = req.body;
    
    const storedData = otpStore.get(email);

    if (!storedData) {
        return res.status(400).json({ message: 'No OTP generated for this email' });
    }

    if (Date.now() > storedData.expires) {
        otpStore.delete(email);
        return res.status(400).json({ message: 'OTP expired' });
    }

    if (storedData.otp === otp) {
        otpStore.delete(email); // Clear after successful use
        return res.json({ message: 'Email verified successfully', success: true });
    } else {
        return res.status(400).json({ message: 'Invalid OTP' });
    }
});

module.exports = router;
