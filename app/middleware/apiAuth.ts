import type { Request, Response, NextFunction } from "express";

import { errorResponse } from "../helper/index";
import db from "../models";

const userModel = db.user;

interface AuthRequest extends Request {
  body: {
    userId?: number;
    [key: string]: any;
  };
}

export const apiAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!(req.headers && req.headers["x-token"])) {
    errorResponse(res, "Token is not provided");
    return;
  }

  const token = req.headers["x-token"] as string;

  try {
    const user = await userModel.findAll({
      attributes: ["userId"],
      raw: true,
      where: {
        token,
        delete: 0,
      },
    });

    console.log(user.length);

    if (user.length === 0) {
      errorResponse(res, "User is not found in system");
      return;
    }

    req.body.userId = user[0].userId;

    return next();
  } catch (error) {
    errorResponse(
      res,
      "Incorrect token is provided, try re-login",
      error
    );
  }
};