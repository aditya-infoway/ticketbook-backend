import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import {
  errorResponse,
  successResponse,
  selectWithJoins,
  updateModel,
} from "../../../helper/index";
import { todayIST } from "../../../helper/dateHelper";

const INVALID = "Invalid email or password.";
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const generateToken = (payload: {
  branchId: number | string;
  companyId: number | string;
}): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");

  return jwt.sign({ ...payload, role: "branch" }, secret, {
    expiresIn: "12h",
  });
};

const getCompanyFinancialYears = async (
  companyId: number | string,
  companyName: string,
) => {
  const years: any[] = await selectWithJoins(
    "financialyear",
    [],
    { companyId, delete: 0 },
    ["financialYearId", "companyDetailsId", "companyId", "startDate", "endDate"],
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

export const branchLogin = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return errorResponse(res, "Email and password are required.");
    }

    // branchEmail saari companies mein unique hai, isliye email se lookup safe hai
    const rows: any[] = await selectWithJoins(
      "branch",
      [],
      { branchEmail: email, delete: 0 },
      [
        "branchId",
        "companyId",
        "branchNo",
        "branchCode",
        "branchName",
        "branchEmail",
        "password",
        "status",
      ],
    );

    const branch = rows[0];

    if (!branch || !branch.password) {
      await bcrypt.compare(password, DUMMY_HASH);
      return errorResponse(res, INVALID);
    }

    if (!(await bcrypt.compare(password, branch.password))) {
      return errorResponse(res, INVALID);
    }

    if (branch.status !== "Active") {
      return errorResponse(
        res,
        "This branch is inactive. Please contact the administrator.",
      );
    }

    const companies: any[] = await selectWithJoins(
      "company",
      [],
      { companyId: branch.companyId, delete: 0 },
      ["companyId", "companyName", "status", "expiryDate"],
    );
    const company = companies[0];

    if (!company || String(company.status || "").toUpperCase() === "REJECTED") {
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
      branch.companyId,
      company.companyName,
    );

    if (financialYears.length === 0) {
      return errorResponse(
        res,
        "No financial year found for your company. Please contact the administrator.",
      );
    }

    const token = generateToken({
      branchId: branch.branchId,
      companyId: branch.companyId,
    });

    await updateModel(
      "branch",
      { token, tokenDate: todayIST() },
      { branchId: branch.branchId, companyId: branch.companyId },
    );

    return successResponse(
      res,
      {
        token,
        email: branch.branchEmail,
        branchId: branch.branchId,
        branchNo: branch.branchNo,
        branchCode: branch.branchCode,
        branchName: branch.branchName,
        companyId: branch.companyId,
        companyName: company.companyName,
        financialYears,
      },
      "Login successful.",
    );
  } catch (error) {
    console.error("branchLogin error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};