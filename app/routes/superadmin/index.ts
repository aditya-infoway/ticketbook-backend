import { Application } from "express";

import superadminRoutes from "./superadmin.routes";
import departmenttypeRoutes from "./departmenttype.routes";
import regiontypeRoutes from "./regiontype.routes";
import departmentRoutes from "./department.routes";
export default (app: Application): void => {
  superadminRoutes(app);
  departmenttypeRoutes(app);
  regiontypeRoutes(app);
   departmentRoutes(app);
};


