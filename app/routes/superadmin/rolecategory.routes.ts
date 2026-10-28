import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as roleCategory from "../../controllers/superadmin/controller/rolecategorycontroller";
import {
  roleCategoryCreateSchema,
  roleCategoryUpdateSchema,
} from "../../controllers/superadmin/validator/rolecategoryvalidator";
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

// ---- Role Category ----
routes.get("/list", roleCategory.getRoleCategoryList);

routes.post(
  "/create",
  validate(roleCategoryCreateSchema),
  roleCategory.createRoleCategory,
);

routes.put(
  "/update",
  validate(roleCategoryUpdateSchema),
  roleCategory.updateRoleCategory,
);

routes.delete("/delete", roleCategory.deleteRoleCategory);

export default (app: Application): void => {
  app.use("/superadmin/role-category", routes);
};