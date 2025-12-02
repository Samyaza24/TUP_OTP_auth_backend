const pool = require("./db").pool;
const nodemailer = require("nodemailer");

require("dotenv").config();

// Initialize Nodemailer SMTP transporter from environment
const transporter = nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || 'gmail',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false, // use STARTTLS on 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        // allow self-signed / corporate MITM proxies if present
        rejectUnauthorized: false,
        minVersion: 'TLSv1',
    },
    connectionTimeout: Number(process.env.SMTP_CONN_TIMEOUT || 15000), // 15s
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000), // 20s
});

// Verify transporter on startup (optional, logs only)
transporter.verify().then(() => {
    console.log("SMTP transporter ready");
}).catch((err) => {
    console.error("SMTP transporter verification failed:", err?.message || err);
});


async function sendOTP(req, res) {
    const { email } = req.body;

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

    try {
        // Insert or update the OTP in the database
        await pool.query(
            "INSERT INTO otps (email, code, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at",
            [email, otp, otpExpiry]
        );

        // Send OTP via email using Nodemailer SMTP
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.error("SMTP credentials missing: set SMTP_USER and SMTP_PASS")
            return res.status(500).json({ message: "Email service not configured" })
        }
        const mailFrom = process.env.EMAIL_FROM || process.env.SMTP_USER
        try {
            await transporter.sendMail({
                from: mailFrom,
                to: email,
                replyTo: "group1.ers.recovery@gmail.com",
                subject: "Your OTP Code",
                html: `<p>Your OTP code is <strong>${otp}</strong>. It is valid for 5 minutes.</p>`,
            })
            console.log("OTP email sent successfully to", email)
            return res.status(200).json({ message: "OTP sent successfully" })
        } catch (err) {
            console.error("Error sending email:", err?.response || err?.message || err)
            return res.status(502).json({ message: "Failed to send OTP email" })
        }

    } catch (error) {
        console.error("Error storing OTP in database:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}


async function verifyOTP(req, res) {
    const { email, otp } = req.body;

    try {
        const result = await pool.query(
            "SELECT * FROM otps WHERE email = $1 AND code = $2",
            [email.trim(), String(otp).trim()]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        const otpData = result.rows[0];
        if (new Date() > otpData.expires_at) {
            return res.status(400).json({ message: "OTP has expired" });
        }
        // OTP is valid, delete it from the database
        await pool.query("DELETE FROM otps WHERE email = $1", [otpData.email]);

        res.status(200).json({ message: "OTP verified successfully" });

    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ error: "verification failed" });
    }
}

module.exports = { sendOTP, verifyOTP };