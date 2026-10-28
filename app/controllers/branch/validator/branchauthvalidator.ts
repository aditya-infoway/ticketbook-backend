import { Request, Response, NextFunction } from "express";
import { requiredmessage } from "../../../helper/index";

export const branchLoginValidator = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");

  if (!email) return requiredmessage(res, "Email is required.");
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return requiredmessage(res, "Enter a valid email.");
  }
  if (!password) return requiredmessage(res, "Password is required.");

  next();
};