import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as employeeType from "../../controllers/superadmin/controller/employeetypecontroller";
import {
  employeeTypeCreateSchema,
  employeeTypeUpdateSchema,
} from "../../controllers/superadmin/validator/employeetypevalidator";
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

// ---- Employee Type ----
routes.get("/next-number", employeeType.getNextEmployeeTypeNo);
routes.get("/list", employeeType.getEmployeeTypeList);
routes.post(
  "/create",
  validate(employeeTypeCreateSchema),
  employeeType.createEmployeeType,
);
routes.put(
  "/update",
  validate(employeeTypeUpdateSchema),
  employeeType.updateEmployeeType,
);
routes.delete("/delete", employeeType.deleteEmployeeType);

export default (app: Application): void => {
  app.use("/superadmin/employee-type", routes);
};
