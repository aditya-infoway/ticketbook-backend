import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as regionType from "../../controllers/superadmin/controller/regiontypecontroller";
import {
  regionTypeCreateSchema,
  regionTypeUpdateSchema,
} from "../../controllers/superadmin/validator/regiontypevalidator";
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

// ---- Region Type ----
routes.get("/list", regionType.getRegionTypeList);
routes.get("/next-number", regionType.getNextRegionTypeNo);

routes.post(
  "/create",
  validate(regionTypeCreateSchema),
  regionType.createRegionType,
);

routes.put(
  "/update",
  validate(regionTypeUpdateSchema),
  regionType.updateRegionType,
);

routes.delete("/delete", regionType.deleteRegionType);

export default (app: Application): void => {
  app.use("/superadmin/region-type", routes);
};
  