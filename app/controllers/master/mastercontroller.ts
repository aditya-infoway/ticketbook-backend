import nodemailer from "nodemailer";
import md5 from "md5";
import type { Request, Response } from "express";
import {
  errorResponse,
  successResponse,
  uniqueId,
  selectWithJoins,
  updateModel,
  requiredmessage,
  generateOTP,
  getBlobTempPublicUrl,
} from "../../helper/index";

interface AdminRow {
  adminId: number;
  name: string;
  email: string;
  mobileNumber?: string;
  profile?: string;
  otp?: string | null;
  otpExpiry?: Date | string | null;
}

const OTP_VALIDITY_MS = 5 * 60 * 1000;
const SESSION_MSG = "Invalid or expired session. Please login again.";

// otpToken (pending, pre-OTP) se admin dhundo
const findAdminByOtpToken = async (otpToken: string): Promise<AdminRow | null> => {
  if (!otpToken) return null;

  const admin = await selectWithJoins(
    "admin",
    [],
    { otpToken, delete: 0 },
    ["adminId", "name", "email", "mobileNumber", "profile", "otp", "otpExpiry"],
  );

  return admin.length > 0 ? (admin[0] as AdminRow) : null;
};

const isOtpExpired = (expiry?: Date | string | null) =>
  !expiry || new Date(expiry).getTime() < Date.now();

// ---- SMTP transporter ----
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendOtpEmail = async (toEmail: string, otp: string) => {
  return transporter.sendMail({
    from: `"Amaar Admin" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Your OTP Code",
    html: `
      <div style="font-family:Arial,sans-serif;padding:20px">
        <h2>OTP Verification</h2>
        <p>Your OTP code is:</p>
        <h1 style="letter-spacing:8px">${otp}</h1>
        <p>This OTP is valid for 5 minutes. Please do not share it with anyone.</p>
      </div>
    `,
  });
};

// STEP 1: login -> password check, otpToken + otp generate, mail bhejo
export const login = async (req: Request, res: Response) => {
  try {
    const email: string = req.body.email || "";
    const password: string = req.body.password || "";

    if (!email || !password) {
      return requiredmessage(res, "Email and Password are required.");
    }

    const admin = await selectWithJoins(
      "admin",
      [],
      { email, password: md5(password), delete: 0 },
      ["adminId", "name", "email"],
    );

    if (admin.length === 0) {
      return requiredmessage(res, "Invalid Email or Password");
    }

    const otpToken = await uniqueId();
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + OTP_VALIDITY_MS);

    // session `token` yahan touch nahi hota — wo sirf OTP verify ke baad banega
    await updateModel(
      "admin",
      { otpToken, otp, otpExpiry, updated: new Date() },
      { adminId: admin[0].adminId, delete: 0 },
    );

    try {
      await sendOtpEmail(admin[0].email, otp);
    } catch (mailErr) {
      console.log("OTP mail error:", mailErr);
      return errorResponse(res, "Failed to send OTP email", mailErr);
    }

    // frontend ko `token` key me pending otpToken milta hai (frontend change nahi chahiye)
    return successResponse(
      res,
      { token: otpToken, email: admin[0].email, name: admin[0].name },
      "Login Successfully. OTP sent to your email.",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// STEP 2: otpVerification -> OTP sahi + expire nahi hua to naya session token do
export const otpVerification = async (req: Request, res: Response) => {
  const otpToken: string = req.body.token || "";
  const otp: string = String(req.body.otp || "");

  try {
    const admin = await findAdminByOtpToken(otpToken);

    if (!admin) {
      return requiredmessage(res, SESSION_MSG);
    }

    if (isOtpExpired(admin.otpExpiry)) {
      return requiredmessage(res, "OTP expired. Please resend OTP.");
    }

    if (!admin.otp || admin.otp !== otp) {
      return requiredmessage(res, "Otp is Wrong !");
    }

    // naya session token — pre-OTP token se alag
    const sessionToken = await uniqueId();

    await updateModel(
      "admin",
      {
        token: sessionToken,
        otp: null,
        otpToken: null,
        otpExpiry: null,
        updated: new Date(),
      },
      { adminId: admin.adminId, delete: 0 },
    );

    return successResponse(
      res,
      {
        token: sessionToken,
        name: admin.name,
        email: admin.email,
        mobileNumber: admin.mobileNumber,
        profile: getBlobTempPublicUrl(admin.profile),
      },
      "Otp Verified",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// resend otp -> otpToken se admin dhundo, naya otp + naya expiry
export const resendOtp = async (req: Request, res: Response) => {
  const otpToken: string = req.body.token || "";

  try {
    const admin = await findAdminByOtpToken(otpToken);

    if (!admin) {
      return requiredmessage(res, SESSION_MSG);
    }

    const otp = generateOTP();
    await updateModel(
      "admin",
      { otp, otpExpiry: new Date(Date.now() + OTP_VALIDITY_MS), updated: new Date() },
      { adminId: admin.adminId, delete: 0 },
    );
    await sendOtpEmail(admin.email, otp);

    return successResponse(res, {}, "OTP Resent Successfully");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};