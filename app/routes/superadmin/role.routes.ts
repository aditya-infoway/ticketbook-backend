import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as role from "../../controllers/superadmin/controller/rolecontroller";
import {
  roleCreateSchema,
  roleUpdateSchema,
} from "../../controllers/superadmin/validator/rolevalidator";
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

// ---- Role ----
routes.get("/list", role.getRoleList);

routes.post("/create", validate(roleCreateSchema), role.createRole);

routes.put("/update", validate(roleUpdateSchema), role.updateRole);

routes.delete("/delete", role.deleteRole);

export default (app: Application): void => {
  app.use("/superadmin/role", routes);
};