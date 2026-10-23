import { Application } from "express";

import superadminRoutes from "./superadmin.routes";

export default (app: Application): void => {
  superadminRoutes(app);
};