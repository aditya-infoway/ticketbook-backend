import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as departmentType from "../../controllers/superadmin/controller/departmenttypecontroller";
import {
  departmentTypeCreateSchema,
  departmentTypeUpdateSchema,
} from "../../controllers/superadmin/validator/departmenttypevalidator";
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

// ---- Department Type ----
routes.get("/list", departmentType.getDepartmentTypeList);

routes.post(
  "/create",
  validate(departmentTypeCreateSchema),
  departmentType.createDepartmentType,
);

// frontend calls Put(...) for update (same as the other master pages)
routes.put(
  "/update",
  validate(departmentTypeUpdateSchema),
  departmentType.updateDepartmentType,
);
routes.delete("/delete", departmentType.deleteDepartmentType);
export default (app: Application): void => {
  app.use("/superadmin/department-type", routes);
};
