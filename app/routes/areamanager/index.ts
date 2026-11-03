import { Application } from "express";
import authRoutes from "./auth.routes";
import areamanagerprofileRoute from "./areamanagerprofile.route";
export default (app: Application): void => {
  authRoutes(app);
  areamanagerprofileRoute(app);
};
