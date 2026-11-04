import { Application, Router } from "express";

import { areaManagerAuth } from "../../middleware/areaManagerToken";
import * as branch from "../../controllers//areamanager/controllers/areamanagerbranchcontroller";

const routes = Router();

// auth per route: /area-manager/login lives on the same prefix and must stay public.
// list and form-data first, so ":id" doesn't swallow them.
routes.get("/branch/list", areaManagerAuth, branch.getAreaManagerBranchList);
routes.get(
  "/branch/form-data",
  areaManagerAuth,
  branch.getAreaManagerBranchFormData,
);
routes.get("/branch/:id", areaManagerAuth, branch.getAreaManagerBranchDetail);

export default (app: Application): void => {
  app.use("/area-manager", routes);
};
