import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as employee from "../../controllers/superadmin/controller/employeecontroller";
import {
  employeeCreateSchema,
  employeeUpdateSchema,
} from "../../controllers/superadmin/validator/employeevalidator";
import { checktoken } from "../../middleware/token";
import { createUploader } from "../../middleware/upload";

const photoUpload = createUploader("employee_photo");
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

// ---- Employee ----
routes.get("/next-number", employee.getNextEmployeeNo);
routes.get("/list", employee.getEmployeeList);
routes.post(
  "/create",
  photoUpload.single("profilePhoto"),
  validate(employeeCreateSchema),
  employee.createEmployee,
);
routes.put(
  "/update",
  photoUpload.single("profilePhoto"),
  validate(employeeUpdateSchema),
  employee.updateEmployee,
);
routes.delete("/delete", employee.deleteEmployee);

export default (app: Application): void => {
  app.use("/superadmin/employee", routes);
};