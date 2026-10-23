import { Application } from "express";

import masterRoutes from "./master/index";
import superadminRoutes from "./superadmin/index";

export default (app: Application): void => {
  masterRoutes(app);
  superadminRoutes(app);
};