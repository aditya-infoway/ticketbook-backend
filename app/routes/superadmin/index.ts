import { Application } from "express";

import superadminRoutes from "./superadmin.routes";
import departmenttypeRoutes from "./departmenttype.routes";
export default (app: Application): void => {
  superadminRoutes(app);
  departmenttypeRoutes(app);
};