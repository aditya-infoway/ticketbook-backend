import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as department from "../../controllers/superadmin/controller/contractordepartmentcontroller";

import {
  contractorDepartmentCreateSchema,
  contractorDepartmentUpdateSchema,
} from "../../controllers/superadmin/validator/contractordepartmentvalidator";

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

// Token check
routes.use(checktoken);

// ---- Contractor Department ----
routes.get("/next-number", department.getNextContractorDepartmentNo);
routes.get("/list", department.getContractorDepartmentList);

routes.post(
  "/create",
  validate(contractorDepartmentCreateSchema),
  department.createContractorDepartment,
);

routes.put(
  "/update",
  validate(contractorDepartmentUpdateSchema),
  department.updateContractorDepartment,
);

routes.delete("/delete", department.deleteContractorDepartment);

export default (app: Application): void => {
  app.use("/superadmin/contractor-department", routes);
};
