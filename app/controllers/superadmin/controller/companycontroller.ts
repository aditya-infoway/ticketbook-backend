import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Op } from "sequelize";
import type { Request, Response } from "express";
import {
  errorResponse,
  successResponse,
  requiredmessage,
  selectWithJoins,
} from "../../../helper/index";
import db from "../../../models/index";

// aaj ki date IST me (YYYY-MM-DD), tokenDate column STRING(10) hai
const todayIST = (): string =>
  new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

// ---- Login ----
export const companyLogin = async (req: Request, res: Response) => {
  try {
    const email: string = req.body.email || "";
    const password: string = req.body.password || "";

    if (!email || !password) {
      return requiredmessage(res, "Email and Password are required.");
    }

    const rows: any[] = await selectWithJoins(
      "company",
      [],
      { email, delete: 0 },
      [
        "companyId",
        "companyName",
        "email",
        "password",
        "expiryDate",
        "token",
        "tokenDate",
      ],
    );

    if (rows.length === 0) {
      return requiredmessage(res, "Invalid Email or Password");
    }

    const company = rows[0];

    const isPasswordValid = await bcrypt.compare(password, company.password);
    if (!isPasswordValid) {
      return requiredmessage(res, "Invalid Email or Password");
    }

    // ---- Expiry date check ----
    if (company.expiryDate) {
      const expiry = new Date(company.expiryDate);
      const now = new Date();
      expiry.setHours(23, 59, 59, 999);

      if (expiry < now) {
        return requiredmessage(
          res,
          "Your subscription has expired. Please contact the administrator to renew.",
        );
      }
    }

    const today = todayIST();
    let token: string = company.token;

    // token nahi hai, ya purane din ka hai -> aaj ka pehla login
    if (!token || company.tokenDate !== today) {
      const newToken = crypto.randomBytes(30).toString("hex");

      // sirf din ke pehle login pe update hoga
      await db.company.update(
        { token: newToken, tokenDate: today, updated: new Date() },
        {
          where: {
            companyId: company.companyId,
            delete: 0,
            [Op.or]: [{ tokenDate: null }, { tokenDate: { [Op.ne]: today } }],
          },
          silent: true,
        },
      );

      // jo token jeeta wahi wapas padho
      const fresh: any = await db.company.findOne({
        where: { companyId: company.companyId },
        attributes: ["token"],
        raw: true,
      });
      token = fresh.token;
    }

    const responseData = {
      companyId: company.companyId,
      companyName: company.companyName,
      email: company.email,
      token,
    };

    return successResponse(res, responseData, "Login Successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Logged-in company ka apna profile ----
export const getProfile = async (req: Request, res: Response) => {
  try {
    const rows: any[] = await selectWithJoins(
      "company",
      [],
      { companyId: (req as any).companyId, delete: 0 },
      [
        "companyId",
        "companyName",
        "companyAddress",
        "email",
        "contactNumber",
        "expiryDate",
      ],
    );

    if (rows.length === 0) {
      return requiredmessage(res, "Company not found.");
    }

    return successResponse(res, rows[0], "Profile fetched successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};