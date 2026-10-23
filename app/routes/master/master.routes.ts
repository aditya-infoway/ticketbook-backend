import {
  Router,
  Request,
  Response,
  NextFunction,
  Application,
} from "express";

import { errorResponse } from "../../helper/index";
import * as master from "../../controllers/master/mastercontroller";
import * as mastervalidation from "../../controllers/master/mastervalidator";
import { checktoken } from "../../middleware/token";

const routes = Router();

const validate = (schema: any) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const { error } = schema.validate(req.body);

    if (error) {
      const message = error.details
        .map((i: any) => i.message)
        .join(",");

      console.log("error", message);

      errorResponse(res, message);
      return;
    }

    next();
  };
};

routes.use(checktoken);

routes.post(
  "/login",
  validate(mastervalidation.login),
  master.login
);

routes.post(
  "/otp-verification",
  validate(mastervalidation.otpVerification),
  master.otpVerification
);

routes.post(
  "/resend-otp",
  validate(mastervalidation.resendOtp),
  master.resendOtp
);

export default (app: Application): void => {
  app.use("/master", routes);
};