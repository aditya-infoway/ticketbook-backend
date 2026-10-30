import { Application, Router, Request, Response, NextFunction } from "express";

import { employeeAuth } from "../../middleware/employeeToken";
import { createUploader } from "../../middleware/upload";
import { errorResponse } from "../../helper/index";
import {
  getNextTicketNo,
  getTicketFormData,
  createTicket,
  updateTicket,
  getTicketList,
} from "../../controllers/employee/controller/ticketcontroller";
import { ticketCreateSchema, ticketUpdateSchema, } from "../../controllers/employee/validator/ticketvalidator";

const upload = createUploader(
  "ticket",
  /^\.(jpeg|jpg|png|pdf)$/,
  "Only PNG, JPG or PDF files are allowed",
);

// multer errors become normal { success: false } responses
const uploadAttachment = (req: Request, res: Response, next: NextFunction) => {
  upload.single("attachment")(req, res, (err: any) => {
    if (err) {
      return errorResponse(
        res,
        err.code === "LIMIT_FILE_SIZE"
          ? "Attachment must be 5MB or smaller."
          : err.message || "Invalid attachment.",
      );
    }
    next();
  });
};

// ---- Joi validation middleware (same style as superadmin) ----
const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: true,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((i: any) => i.message).join(", ");
      errorResponse(res, message);
      return;
    }

    // put cleaned values back so controller gets clean data
    req.body = value;
    next();
  };
};

export default (app: Application): void => {
  const routes = Router();

  routes.use(employeeAuth);

  routes.get("/next-number", getNextTicketNo);
  routes.get("/form-data", getTicketFormData);
  routes.get("/list", getTicketList);

  // validation now lives in the route
  routes.post(
    "/create",
    uploadAttachment,
    validate(ticketCreateSchema),
    createTicket,
  );

  routes.put(
    "/update",
    uploadAttachment,
    validate(ticketUpdateSchema),
    updateTicket,
  );

  app.use("/employee/ticket", routes);
};
