import type { Request, Response, NextFunction } from "express";

import { selectWithJoins } from "../helper/index";
import { getDateString, todayIST } from "../helper/dateHelper";

// purane imports (employeeauthcontroller.ts) na tootein, isliye re-export
export { getDateString, todayIST };

export const checkEmployeeToken = async (token: string) => {
  return await selectWithJoins(
    "employee",
    [],
    { token, delete: 0, employmentStatus: "Active" },
    ["companyId", "employeeId", "employeeName", "officialEmail", "tokenDate"],
  );
};
export const checkContractorToken = async (token: string) => {
  return await selectWithJoins(
    "contractor",
    [],
    { token, delete: 0, status: "Active" },
    ["companyId", "contractorId", "contractorName", "email", "tokenDate"],
  );
};
// Use on employee-panel routes: sets req.employeeId and req.companyId
export const employeeAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  try {
    const token = req.headers["x-token"] as string | undefined;

    if (!token) {
      return res.status(401).json({
        status: 401,
        message: "Authentication failed! Token missing.",
      });
    }

    // 1. Employee
    const rows: any[] = await checkEmployeeToken(token);

    if (rows.length && rows[0].tokenDate === todayIST()) {
      (req as any).employeeId = rows[0].employeeId;
      (req as any).companyId = rows[0].companyId;
      return next();
    }

    // 2. Contractor
    const contractors: any[] = await checkContractorToken(token);

    if (contractors.length && contractors[0].tokenDate === todayIST()) {
      (req as any).contractorId = contractors[0].contractorId;
      (req as any).companyId = contractors[0].companyId;
      (req as any).isContractor = true;
      return next();
    }

    return res.status(401).json({
      status: 401,
      message: "Invalid or expired session. Please login again.",
    });
  } catch (error) {
    return res.status(401).json({
      status: 401,
      message: "Authentication failed!",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};