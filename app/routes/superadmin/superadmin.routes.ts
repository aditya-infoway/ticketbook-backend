import {
  Router,
  Request,
  Response,
  NextFunction,
  Application,
} from "express";

import { errorResponse } from "../../helper/index";
import * as company from "../../controllers/superadmin/controller/companycontroller";
import * as companyDetails from "../../controllers/superadmin/controller/companydetailscontroller";
// import * as prefix from "../../controllers/superadmin/controller/prefixcontroller";
import * as companyvalidation from "../../controllers/superadmin/validator/companyvalidator";
import {
  companyDetailsSchema,
  companyDetailsUpdateSchema,
} from "../../controllers/superadmin/validator/companydetailsvalidator";
// import {
//   prefixCreateSchema,
//   prefixUpdateSchema,
// } from "../../controllers/superadmin/validator/prefixvalidator";
import { checktoken } from "../../middleware/token";
import { createUploader } from "../../middleware/upload";

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

// logoUpload yahan define hona zaruri hai, export default se PEHLE
const logoUpload = createUploader("company_logo");

// apitoken header check
routes.use(checktoken);

// ---- Auth / Profile ----
routes.post("/login", validate(companyvalidation.companyLogin), company.companyLogin);
routes.get("/profile", company.getProfile);

// ---- Company Details ----
routes.post(
  "/company-details/create",
  validate(companyDetailsSchema),
  companyDetails.createCompanyDetails,
);

// multer pehle chalega (multipart parse), uske baad validate
routes.post(
  "/company-details/update",
  logoUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "icon", maxCount: 1 },
  ]),
  validate(companyDetailsUpdateSchema),
  companyDetails.updateCompanyDetails,
);

routes.get("/financial-years", companyDetails.getFinancialYears);
routes.get("/company-details", companyDetails.getCompanyDetails);

// ---- Prefix ----
// routes.post("/prefix/create", validate(prefixCreateSchema), prefix.createPrefix);
// routes.post("/prefix/update", validate(prefixUpdateSchema), prefix.updatePrefix);
// routes.get("/prefix/list", prefix.getPrefixList);
// 
export default (app: Application): void => {
  app.use("/superadmin", routes);
};