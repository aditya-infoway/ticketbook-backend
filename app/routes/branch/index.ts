import { Application } from "express";

import authRoutes from "./branch.routes";
import branchProfileRoutes from "./branchprofile.route";
import branchticketRoutes from "./branchticket.routes";
import branchcontractorreviewRoutes from "./branchcontractorreview.routes";
export default (app: Application): void => {
  authRoutes(app);
  branchProfileRoutes(app);
  branchticketRoutes(app);
  branchcontractorreviewRoutes(app);
};
