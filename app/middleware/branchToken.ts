import type { Request, Response, NextFunction } from "express";

import { selectWithJoins } from "../helper/index";
import { todayIST } from "../helper/dateHelper";

export const checkBranchToken = async (token: string) => {
  return await selectWithJoins(
    "branch",
    [],
    { token, delete: 0, status: "Active" },
    ["companyId", "branchId", "branchName", "branchEmail", "tokenDate"],
  );
};

// Use on branch-panel routes: sets req.branchId and req.companyId
export const branchAuth = async (
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

    const rows: any[] = await checkBranchToken(token);

    if (!rows.length || rows[0].tokenDate !== todayIST()) {
      return res.status(401).json({
        status: 401,
        message: "Invalid or expired session. Please login again.",
      });
    }

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