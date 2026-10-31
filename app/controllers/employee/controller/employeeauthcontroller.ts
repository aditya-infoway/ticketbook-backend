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
  employeeId: number | string;
  companyId: number | string;
}): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");

  return jwt.sign({ ...payload, role: "employee" }, secret, {
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
    [
      "financialYearId",
      "companyDetailsId",
      "companyId",
      "startDate",
      "endDate",
    ],
  );

  const day = (value: any) => String(value || "").slice(0, 10); // YYYY-MM-DD

  return [...years]
    .sort((a, b) => day(b.startDate).localeCompare(day(a.startDate)))
    .map((y) => ({
      financialYearId: y.financialYearId,
      companyDetailsId: y.companyDetailsId,
      companyId: y.companyId,
      startDate: y.startDate,
      endDate: y.endDate,
      companyName,
    }));
};

export const employeeLogin = async (
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

    // ---------- 1. Try Employee first ----------
    let rows: any[] = await selectWithJoins(
      "employee",
      [],
      { officialEmail: email, delete: 0 },
      [
        "employeeId",
        "companyId",
        "employeeName",
        "officialEmail",
        "password",
        "employmentStatus",
        "employmentEndDate",
        "roleId",
      ],
    );

    let user = rows[0];
    let isContractor = false;

    // ---------- 2. If no employee → try Contractor ----------
    if (!user || !user.password) {
      rows = await selectWithJoins(
        "contractor", // ← your real table name
        [],
        { email: email, delete: 0 }, // adjust column name if different
        [
          "contractorId",
          "companyId",
          "contractorName",
          "email",
          "password",
          "status",
          // add any other columns you need
        ],
      );

      user = rows[0];
      isContractor = true;
    }

    // ---------- Common password check ----------
    if (!user || !user.password) {
      await bcrypt.compare(password, DUMMY_HASH);
      return errorResponse(res, INVALID);
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return errorResponse(res, INVALID);
    }

    // ---------- Status checks ----------
    if (isContractor) {
      if (String(user.status || "").toUpperCase() !== "ACTIVE") {
        return errorResponse(
          res,
          "Your account is inactive. Please contact the administrator.",
        );
      }
    } else {
      // original employee checks
      if (user.employmentStatus !== "Active") {
        return errorResponse(
          res,
          "Your account is inactive. Please contact the administrator.",
        );
      }
      if (user.employmentEndDate && user.employmentEndDate < todayIST()) {
        return errorResponse(
          res,
          "Your employment has ended. Please contact the administrator.",
        );
      }
    }

    // ---------- Company checks (same for both) ----------
    const companies: any[] = await selectWithJoins(
      "company",
      [],
      { companyId: user.companyId, delete: 0 },
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
    // ---------- Financial years (Select Company page ke liye) ----------
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

    // ---------- Role name ----------
    let roleName = "";
    if (isContractor) {
      roleName = "contractor";
    } else if (user.roleId) {
      const roles: any[] = await selectWithJoins(
        "role",
        [],
        { roleId: user.roleId, companyId: user.companyId, delete: 0 },
        ["roleName"],
      );
      roleName = roles[0]?.roleName || "";
    }
    // ---------- Generate token ----------
    const token = jwt.sign(
      {
        ...(isContractor
          ? { contractorId: user.contractorId }
          : { employeeId: user.employeeId }),
        companyId: user.companyId,
        role: isContractor ? "contractor" : "employee",
      },
      process.env.JWT_SECRET!,
      { expiresIn: "12h" },
    );

    // Optional: update token on the respective table
    if (isContractor) {
      await updateModel(
        "contractor",
        { token, tokenDate: todayIST() },
        { contractorId: user.contractorId },
      );
    } else {
      await updateModel(
        "employee",
        { token, tokenDate: todayIST() },
        { employeeId: user.employeeId, companyId: user.companyId },
      );
    }

    // ---------- Response ----------
    const responseData: any = {
      token,
      email: isContractor ? user.email : user.officialEmail,
      companyId: user.companyId,
      companyName: company.companyName,
      financialYears, // <- wapas
      roleName,
      isContractor, // useful on frontend
    };

    if (isContractor) {
      responseData.contractorId = user.contractorId;
      responseData.contractorName = user.contractorName;
      responseData.role = "contractor";
    } else {
      responseData.employeeId = user.employeeId;
      responseData.employeeName = user.employeeName;
      responseData.role = "employee";
      // keep the financialYears logic if you need it for employees
    }

    return successResponse(res, responseData, "Login successful.");
  } catch (error) {
    console.error("employeeLogin error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
