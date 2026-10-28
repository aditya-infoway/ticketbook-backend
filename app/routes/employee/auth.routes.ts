import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse, requiredmessage } from "../../helper/index";
import { employeeLogin } from "../../controllers/employee/controller/employeeauthcontroller";
import { employeeLoginSchema } from "../../controllers/employee/validator/employeeauthvalidator";

const routes = Router();

const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);

    if (error) {
      const message = error.details.map((i: any) => i.message).join(",");
      console.log("error", message);
      errorResponse(res, message);
      return;
    }

    next();
  };
};

const checkApiToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.headers.apitoken !== "2ed1b72407c91c22dc7bd2b729f67145") {
    requiredmessage(res, "Invalid API Token");
    return;
  }
  next();
};

routes.post(
  "/login",
  checkApiToken,
  validate(employeeLoginSchema),
  employeeLogin,
);

export default (app: Application): void => {
  app.use("/employee", routes);
};
