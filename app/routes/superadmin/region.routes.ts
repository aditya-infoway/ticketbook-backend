import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";

import * as region from "../../controllers/superadmin/controller/regioncontroller";

import {
  regionCreateSchema,
  regionUpdateSchema,
} from "../../controllers/superadmin/validator/regionvalidator";

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

// API token check
routes.use(checktoken);

// ---- Region / Area ----

routes.get("/next-number", region.getNextRegionNo);

routes.get("/list", region.getRegionList);

routes.post("/create", validate(regionCreateSchema), region.createRegion);

routes.put("/update", validate(regionUpdateSchema), region.updateRegion);

routes.delete("/delete", region.deleteRegion);

export default (app: Application): void => {
  app.use("/superadmin/region", routes);
};
