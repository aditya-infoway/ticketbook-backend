import { Application } from "express";

import superadminRoutes from "./superadmin.routes";
import departmenttypeRoutes from "./departmenttype.routes";
import regiontypeRoutes from "./regiontype.routes";
import departmentRoutes from "./department.routes";
import regionRoutes from "./region.routes";
import rolecategoryRoutes from "./rolecategory.routes";
import roleRoutes from "./role.routes";
import branchRoutes from "./branch.routes";
import employeetypeRoutes from "./employeetype.routes";
import employeeRoutes from "./employee.routes";
import resolverteamRoutes from "./resolverteam.routes";
import ticketcategoryRoutes from "./ticketcategory.routes";
import ticketstatusRoutes from "./ticketstatus.routes";
import contractordepartmentRoutes from "./contractordepartment.routes";
import contractorRoutes from "./contractor.routes";

export default (app: Application): void => {
  superadminRoutes(app);
  departmenttypeRoutes(app);
  regiontypeRoutes(app);
  departmentRoutes(app);
  regionRoutes(app);
  rolecategoryRoutes(app);
  roleRoutes(app);
  branchRoutes(app);
  employeetypeRoutes(app);
  employeeRoutes(app);
  resolverteamRoutes(app);
  ticketcategoryRoutes(app);
  ticketstatusRoutes(app);
  contractordepartmentRoutes(app);
  contractorRoutes(app);
};
