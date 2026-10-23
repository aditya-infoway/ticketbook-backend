import {
  Router,
  Request,
  Response,
  NextFunction,
  Application,
} from "express";

import { errorResponse } from "../../helper/index";
import * as company from "../../controllers/master/companycontroller";
import * as companyvalidation from "../../controllers/master/companyvalidator";
import { checktoken } from "../../middleware/authToken";

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

// same apitoken header check jo master.routes.ts me hai
routes.use(checktoken);

routes.post(
  "/create",
  validate(companyvalidation.createCompany),
  company.createCompany,
);

routes.get("/list", company.getCompanyList);

export default (app: Application): void => {
  app.use("/master/company", routes);
};