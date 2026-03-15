import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // The 16-character App Password
  },
});

export const sendWelcomeEmail = async (to, userName) => {
  const mailOptions = {
    from: `"FluencyJet" <${process.env.EMAIL_USER}>`,
    to,
    subject: "வணக்கம்! Welcome to Sentence Master 🚀",
    text: `Hi ${userName}, ready to master English sentences? Log in here: https://fluencyjet.com`,
  };

  return transporter.sendMail(mailOptions);
};
