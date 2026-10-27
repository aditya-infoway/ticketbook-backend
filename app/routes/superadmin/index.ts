import { Application } from "express";

import superadminRoutes from "./superadmin.routes";
import departmenttypeRoutes from "./departmenttype.routes";
import regiontypeRoutes from "./regiontype.routes";
import departmentRoutes from "./department.routes";
import regionRoutes from "./region.routes";
import rolecategoryRoutes from "./rolecategory.routes";
import roleRoutes from "./role.routes";
export default (app: Application): void => {
  superadminRoutes(app);
  departmenttypeRoutes(app);
  regiontypeRoutes(app);
  departmentRoutes(app);
  regionRoutes(app);
  rolecategoryRoutes(app);
  roleRoutes(app);
};
