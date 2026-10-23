import {
  Router,
  Request,
  Response,
  NextFunction,
  Application,
} from "express";

import { errorResponse } from "../../helper/index";
import * as company from "../../controllers/superadmin/controller/companycontroller";
import * as companyvalidation from "../../controllers/superadmin/validator/companyvalidator";
import { checktoken } from "../../middleware/token";

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

// apitoken header check
routes.use(checktoken);

routes.post("/login", validate(companyvalidation.companyLogin), company.companyLogin);
routes.get("/profile", company.getProfile);

export default (app: Application): void => {
  app.use("/superadmin", routes);
};