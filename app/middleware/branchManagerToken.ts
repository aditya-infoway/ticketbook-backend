import type { Request, Response, NextFunction } from "express";

import { selectWithJoins } from "../helper/index";
import { todayIST } from "../helper/dateHelper";

// Sets req.branchManagerId, req.branchId and req.companyId.
// Status is checked on every request, and the manager's branch must be Active too.
export const branchManagerAuth = async (
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

    const rows: any[] = await selectWithJoins(
      "branchmanager",
      [],
      { token, delete: 0, status: "Active" },
      ["branchManagerId", "companyId", "branchId", "tokenDate"],
    );

    if (!rows.length || rows[0].tokenDate !== todayIST()) {
      return res.status(401).json({
        status: 401,
        message: "Invalid or expired session. Please login again.",
      });
    }

    const branchRows: any[] = await selectWithJoins(
      "branch",
      [],
      {
        branchId: rows[0].branchId,
        companyId: rows[0].companyId,
        delete: 0,
        status: "Active",
      },
      ["branchId"],
    );

    if (!branchRows.length) {
      return res.status(401).json({
        status: 401,
        message: "Invalid or expired session. Please login again.",
      });
    }

    (req as any).branchManagerId = rows[0].branchManagerId;
    (req as any).branchId = rows[0].branchId;
    (req as any).companyId = rows[0].companyId;

    next();
  } catch (error) {
    return res.status(401).json({
      status: 401,
      message: "Authentication failed!",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
