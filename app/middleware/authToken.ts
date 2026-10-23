import type { Request, Response, NextFunction } from "express";

import {
  selectWithJoins,
  requiredmessage,
} from "../helper/index";

interface AdminRequest extends Request {
  admin?: {
    adminId: number;
    name: string;
    email: string;
  };
}

export const checktoken = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // API Token
    const apiToken = req.headers.apitoken;

    if (apiToken !== "2ed1b72407c91c22dc7bd2b729f67145") {
      requiredmessage(res, "Invalid API Token");
      return;
    }

    // Login Token
    const token = req.headers["x-token"];

    if (!token) {
      requiredmessage(res, "Token is required");
      return;
    }

    const admin = await selectWithJoins(
      "admin",
      [],
      {
        token,
        delete: 0,
      },
      ["adminId", "name", "email"]
    );

    if (admin.length === 0) {
      requiredmessage(res, "Invalid or Expired Token");
      return;
    }

    // Future use ke liye req me store kar do
    req.admin = admin[0] as {
      adminId: number;
      name: string;
      email: string;
    };

    next();
  } catch (err) {
    console.log(err);
    requiredmessage(res, "Invalid Token");
  }
};