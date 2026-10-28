import { Application } from "express";

import masterRoutes from "./master/index";
import superadminRoutes from "./superadmin/index";
import employeeRoutes from "./employee/index";
import branchRoutes from "./branch/index";
export default (app: Application): void => {
  masterRoutes(app);
  superadminRoutes(app);
  employeeRoutes(app);
  branchRoutes(app);
};
