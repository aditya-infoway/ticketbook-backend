import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as department from "../../controllers/superadmin/controller/departmentcontroller";
import {
  departmentCreateSchema,
  departmentUpdateSchema,
} from "../../controllers/superadmin/validator/departmentvalidator";
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

// ---- Department ----
routes.get("/next-number", department.getNextDepartmentNo);
routes.get("/list", department.getDepartmentList);

routes.post(
  "/create",
  validate(departmentCreateSchema),
  department.createDepartment,
);

// frontend calls Put(...) for update (same as the other master pages)
routes.put(
  "/update",
  validate(departmentUpdateSchema),
  department.updateDepartment,
);

routes.delete("/delete", department.deleteDepartment);

export default (app: Application): void => {
  app.use("/superadmin/department", routes);
};