import type { Request, Response, NextFunction } from "express";

export const checktoken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (
    "2ed1b72407c91c22dc7bd2b729f67145" !==
    req.headers.apitoken
  ) {
    res.status(401).json({
      status: 401,
      message: "Authentication failed!!",
    });

    return;
  }

  next();
};