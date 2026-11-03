import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import {
  errorResponse,
  successResponse,
  selectWithJoins,
  updateModel,
} from "./index";
import { todayIST } from "./dateHelper";

const INVALID = "Invalid email or password.";
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export interface PanelLoginConfig {
  table: string; // "areamanager"
  idColumn: string; // "areaManagerId"
  role: string; // goes into the token and the response
  extraColumns?: string[];
  // return an error message to refuse the login
  extraCheck?: (user: any) => Promise<string | null>;
  extraResponse?: (user: any) => Promise<Record<string, unknown>>;
}

const getCompanyFinancialYears = async (
  companyId: number | string,
  companyName: string,
) => {
  const years: any[] = await selectWithJoins(
    "financialyear",
    [],
    { companyId, delete: 0 },
    [
      "financialYearId",
      "companyDetailsId",
      "companyId",
      "startDate",
      "endDate",
    ],
  );

  const time = (value: any) => new Date(value).getTime() || 0;

  return [...years]
    .sort((a, b) => time(b.startDate) - time(a.startDate))
    .map((y) => ({
      financialYearId: y.financialYearId,
      companyDetailsId: y.companyDetailsId,
      companyId: y.companyId,
      startDate: y.startDate,
      endDate: y.endDate,
      companyName,
    }));
};

// Email + password login for a panel that has its own table.
// Allowed only while the account's status is "Active".
export const panelLogin =
  (cfg: PanelLoginConfig) =>
  async (req: Request, res: Response): Promise<any> => {
    try {
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      const password = String(req.body?.password || "");

      if (!email || !password) {
        return errorResponse(res, "Email and password are required.");
      }

      // email is unique across companies in these tables, so lookup by email is safe
      const rows: any[] = await selectWithJoins(
        cfg.table,
        [],
        { email, delete: 0 },
        [
          cfg.idColumn,
          "companyId",
          "name",
          "email",
          "password",
          "status",
          ...(cfg.extraColumns || []),
        ],
      );

      const user = rows[0];

      if (!user || !user.password) {
        await bcrypt.compare(password, DUMMY_HASH);
        return errorResponse(res, INVALID);
      }

      if (!(await bcrypt.compare(password, user.password))) {
        return errorResponse(res, INVALID);
      }

      if (user.status !== "Active") {
        return errorResponse(
          res,
          "Your account is inactive. Please contact the administrator.",
        );
      }

      if (cfg.extraCheck) {
        const problem = await cfg.extraCheck(user);
        if (problem) return errorResponse(res, problem);
      }

      const companies: any[] = await selectWithJoins(
        "company",
        [],
        { companyId: user.companyId, delete: 0 },
        ["companyId", "companyName", "status", "expiryDate"],
      );
      const company = companies[0];

      if (
        !company ||
        String(company.status || "").toUpperCase() === "REJECTED"
      ) {
        return errorResponse(
          res,
          "Company account is not active. Please contact the administrator.",
        );
      }

      if (company.expiryDate) {
        const expiry = new Date(company.expiryDate);
        expiry.setHours(23, 59, 59, 999);
        if (expiry < new Date()) {
          return errorResponse(
            res,
            "Your company subscription has expired. Please contact the administrator.",
          );
        }
      }

      const financialYears = await getCompanyFinancialYears(
        user.companyId,
        company.companyName,
      );
      if (financialYears.length === 0) {
        return errorResponse(
          res,
          "No financial year found for your company. Please contact the administrator.",
        );
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error("JWT_SECRET is not set");

      const token = jwt.sign(
        {
          [cfg.idColumn]: user[cfg.idColumn],
          companyId: user.companyId,
          role: cfg.role,
        },
        secret,
        { expiresIn: "12h" },
      );

      await updateModel(
        cfg.table,
        { token, tokenDate: todayIST() },
        { [cfg.idColumn]: user[cfg.idColumn], companyId: user.companyId },
      );

      return successResponse(
        res,
        {
          token,
          role: cfg.role,
          email: user.email,
          [cfg.idColumn]: user[cfg.idColumn],
          name: user.name,
          companyId: user.companyId,
          companyName: company.companyName,
          financialYears,
          ...(cfg.extraResponse ? await cfg.extraResponse(user) : {}),
        },
        "Login successful.",
      );
    } catch (error) {
      console.error("panelLogin error:", error);
      return errorResponse(res, "Something Went Wrong", error);
    }
  };
