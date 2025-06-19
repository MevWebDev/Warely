import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function testEmail() {
  try {
    console.log("🔗 Testing SMTP connection...");
    await transporter.verify();
    console.log("✅ SMTP connection successful");

    console.log("📤 Sending test email...");
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: "cwel@pxseu.com",
      subject: "Test Email from Warely",
      text: "If you receive this, email setup is working!",
    });

    console.log("✅ Test email sent successfully");
  } catch (error) {
    console.error("❌ Email test failed:", error);
  }
}

testEmail();
