import { Application } from "express";

import authRoutes from "./auth.routes";

export default (app: Application): void => {
  authRoutes(app);
};
