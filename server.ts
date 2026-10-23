import express, { Application, Request, Response } from "express";
import cors from "cors";
import path from "path";

import db from "./app/models/index";
import routes from "./app/routes/index";

const app: Application = express();

// Development ke liye sab origins allow
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// set alter: true when sync model with database
db.sequelize
  .sync({ alter: true })
  .then(() => {
    console.log("Synced db.");
  })
  .catch((err: any) => {
    console.log("Failed to sync db: " + err.message);
    console.log(err.message);
    console.log(err.parent?.message);
    console.log(err.sql);
  });

app.use(
  "/Uploadimages",
  express.static(path.join(__dirname, "Uploadimages"))
);

// simple route
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Welcome to Amaar Software.",
  });
});

// all module routes (/master/login, /master/otp-verification, /master/resend-otp)
routes(app);

// set port, listen for requests
const PORT: number = Number(process.env.PORT) || 8001;

app.listen(PORT, () => {
  console.log(
    `⚡️[server]: Server is running at http://localhost:${PORT}`
  );
});