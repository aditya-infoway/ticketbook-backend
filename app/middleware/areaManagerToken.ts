import type { Request, Response, NextFunction } from "express";

import { selectWithJoins } from "../helper/index";
import { todayIST } from "../helper/dateHelper";

// Sets req.areaManagerId and req.companyId. Status is checked on every request,
// so setting an area manager Inactive locks them out immediately.
export const areaManagerAuth = async (
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
      "areamanager",
      [],
      { token, delete: 0, status: "Active" },
      ["areaManagerId", "companyId", "tokenDate"],
    );

    if (!rows.length || rows[0].tokenDate !== todayIST()) {
      return res.status(401).json({
        status: 401,
        message: "Invalid or expired session. Please login again.",
      });
    }

    (req as any).areaManagerId = rows[0].areaManagerId;
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
