import type { Request, Response, NextFunction } from "express";

import {
  selectWithJoins,
  requiredmessage,
} from "../helper/index";

interface CompanyRequest extends Request {
  company?: {
    companyId: number;
    companyName: string;
    email: string;
  };
}

export const checkCompanyToken = async (
  req: CompanyRequest,
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

    const company = await selectWithJoins(
      "company",
      [],
      {
        token,
        delete: 0,
      },
      ["companyId", "companyName", "email"]
    );

    if (company.length === 0) {
      requiredmessage(res, "Invalid or Expired Token");
      return;
    }

    // Future use ke liye req me store kar do
    req.company = company[0] as {
      companyId: number;
      companyName: string;
      email: string;
    };

    next();
  } catch (err) {
    console.log(err);
    requiredmessage(res, "Invalid Token");
  }
};