import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import {
  errorResponse,
  successResponse,
  selectWithJoins,
  updateModel,
} from "../../../helper/index";
import { todayIST } from "../../../middleware/employeeToken";

// Same message for every credential failure (don't reveal which part was wrong)
const INVALID = "Invalid email or password.";

// TODO: replace the body with the SAME generator your superadmin login uses
// (the frontend runs isTokenValid() on this token when the page is refreshed)
const generateToken = (): string => crypto.randomBytes(32).toString("hex");

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

    // New login replaces the old token (one active session per employee)
    const token = generateToken();

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
        roleName,
      },
      "Login successful.",
    );
  } catch (error) {
    console.error("employeeLogin error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
