import { Request } from "express";
import jwt from "jsonwebtoken";
import { selectWithJoins } from "./index";

type Id = string | number;

/**
 * Works for:
 * - Branch login     → token in branch table
 * - Employee login   → token in employee table
 * - Company login    → token in company table
 * - Other panels     → falls back to JWT payload
 */
export const getCompanyIdFromAnyToken = async (
  req: Request,
): Promise<Id | null> => {
  const token =
    (req.headers["x-token"] as string) ||
    (req.headers["X-Token"] as string) ||
    "";

  if (!token) return null;

  // ---------- 1. Fast path: decode JWT ----------
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not set");

    const decoded: any = jwt.verify(token, secret);

    // Most reliable - companyId is always present in your tokens
    if (decoded.companyId) {
      return decoded.companyId;
    }
  } catch (err) {
    console.log("JWT verify failed:", (err as Error).message);
    // continue to DB lookup as fallback
  }

  // ---------- 2. Fallback: search in tables (old style) ----------
  // Branch
  const branchRows: any[] = await selectWithJoins(
    "branch",
    [],
    { token, delete: 0 },
    ["branchId", "companyId"],
  );
  if (branchRows.length) return branchRows[0].companyId;

  // Employee
  const empRows: any[] = await selectWithJoins(
    "employee",
    [],
    { token, delete: 0 },
    ["employeeId", "companyId"],
  );
  if (empRows.length) return empRows[0].companyId;

  // Company
  const companyRows: any[] = await selectWithJoins(
    "company",
    [],
    { token, delete: 0 },
    ["companyId"],
  );
  if (companyRows.length) return companyRows[0].companyId;

  return null;
};
