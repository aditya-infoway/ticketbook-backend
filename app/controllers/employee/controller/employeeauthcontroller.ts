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
    ["financialYearId", "companyDetailsId", "companyId", "startDate", "endDate"],
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

    const rows: any[] = await selectWithJoins(
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

    const employee = rows[0];

    // no such employee, or no login password set yet
    if (!employee || !employee.password) {
      await bcrypt.compare(password, DUMMY_HASH);
      return errorResponse(res, INVALID);
    }

    if (!(await bcrypt.compare(password, employee.password))) {
      return errorResponse(res, INVALID);
    }

    if (employee.employmentStatus !== "Active") {
      return errorResponse(
        res,
        "Your account is inactive. Please contact the administrator.",
      );
    }

    if (employee.employmentEndDate && employee.employmentEndDate < todayIST()) {
      return errorResponse(
        res,
        "Your employment has ended. Please contact the administrator.",
      );
    }

    // Employee's company must be approved and not expired
    const companies: any[] = await selectWithJoins(
      "company",
      [],
      { companyId: employee.companyId, delete: 0 },
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
      employee.companyId,
      company.companyName,
    );

    if (financialYears.length === 0) {
      return errorResponse(
        res,
        "No financial year found for your company. Please contact the administrator.",
      );
    }

    // New login replaces the old token (one active session per employee)
    const token = generateToken({
      employeeId: employee.employeeId,
      companyId: employee.companyId,
    });

    await updateModel(
      "employee",
      { token, tokenDate: todayIST() },
      { employeeId: employee.employeeId, companyId: employee.companyId },
    );

    let roleName = "";
    if (employee.roleId) {
      const roles: any[] = await selectWithJoins(
        "role",
        [],
        { roleId: employee.roleId, companyId: employee.companyId, delete: 0 },
        ["roleName"],
      );
      roleName = roles[0]?.roleName || "";
    }

    return successResponse(
      res,
      {
        token,
        email: employee.officialEmail,
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        companyId: employee.companyId,
        companyName: company.companyName,
        financialYears, // list for the Select Company page
        roleName,
      },
      "Login successful.",
    );
  } catch (error) {
    console.error("employeeLogin error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};