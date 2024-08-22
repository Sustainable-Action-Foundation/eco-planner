// This file allows us to use a single transport instance across the entire application.
import { createTransport } from "nodemailer";

const mailClient = createTransport({
  host: process.env.MAIL_HOST || "",
  port: 587,
  name: "eco-planner",
  secure: false,
  auth: {
    user: process.env.MAIL_USER || "",
    pass: process.env.MAIL_PASSWORD || "",
  },
});

export default mailClient;