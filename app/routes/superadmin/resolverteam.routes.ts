import { Router, Request, Response, NextFunction, Application } from "express";

import { errorResponse } from "../../helper/index";
import * as resolverTeam from "../../controllers/superadmin/controller/resolverteamcontroller";
import {
  resolverTeamCreateSchema,
  resolverTeamUpdateSchema,
} from "../../controllers/superadmin/validator/resolverteamvalidator";
import { checktoken } from "../../middleware/token";

const routes = Router();

const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);

    if (error) {
      const message = error.details.map((i: any) => i.message).join(",");
      console.log("error", message);
      errorResponse(res, message);
      return;
    }

    next();
  };
};

// apitoken header check
routes.use(checktoken);

// ---- Resolver Team ----
routes.get("/next-number", resolverTeam.getNextResolverTeamNo);
routes.get("/list", resolverTeam.getResolverTeamList);
routes.post(
  "/create",
  validate(resolverTeamCreateSchema),
  resolverTeam.createResolverTeam,
);
routes.put(
  "/update",
  validate(resolverTeamUpdateSchema),
  resolverTeam.updateResolverTeam,
);
routes.delete("/delete", resolverTeam.deleteResolverTeam);

export default (app: Application): void => {
  app.use("/superadmin/resolver-team", routes);
};
