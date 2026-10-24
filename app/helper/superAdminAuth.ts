import { Request, Response, NextFunction } from "express";
import { checkCompanyToken, todayIST, CompanyTokenRow } from "./checkCompanyToken";

// Express Request me custom fields add kar rahe hain
declare global {
  namespace Express {
    interface Request {
      companyId?: number;
      company?: CompanyTokenRow;
    }
  }
}

export const superAdminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const token = req.headers["x-token"] as string | undefined;

    if (!token) {
      return res.status(401).json({
        status: 401,
        message: "Authentication failed! Token missing.",
      });
    }

    const companyRows = await checkCompanyToken(token);

    if (!companyRows || companyRows.length === 0) {
      return res.status(401).json({
        status: 401,
        message: "Invalid or expired session. Please login again.",
      });
    }

    const company = companyRows[0];

    // token is valid only on the day it was created
    if (company.tokenDate !== todayIST()) {
      return res.status(401).json({
        status: 401,
        message: "Invalid or expired session. Please login again.",
      });
    }

    // expiry dobara check — login ke baad bhi agar expire ho jaaye toh block
    if (company.expiryDate) {
      const expiry = new Date(company.expiryDate);
      expiry.setHours(23, 59, 59, 999);
      if (expiry < new Date()) {
        return res.status(401).json({
          status: 401,
          message:
            "Your subscription has expired. Please contact the administrator.",
        });
      }
    }

    // aage ke controllers me companyId available rahega
    req.companyId = company.companyId;
    req.company = company;

    next();
  } catch (error) {
    return res.status(401).json({
      status: 401,
      message: "Authentication failed!",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};