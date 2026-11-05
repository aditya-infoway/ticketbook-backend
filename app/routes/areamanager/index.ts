import { Application } from "express";
import authRoutes from "./auth.routes";
import areamanagerprofileRoute from "./areamanagerprofile.route";
import branchRoutes from "./branch.routes";
import areamanagerticketRoutes from "./areamanagerticket.routes";

export default (app: Application): void => {
  authRoutes(app);
  areamanagerprofileRoute(app);
  branchRoutes(app);
  areamanagerticketRoutes(app);
};
