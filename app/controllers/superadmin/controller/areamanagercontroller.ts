import { Request, Response } from "express";
import fs from "fs";
import bcrypt from "bcryptjs";

import {
  errorResponse,
  successResponse,
  requiredmessage,
  saveModel,
  updateModel,
  selectWithJoins,
} from "../../../helper/index";
import { getFinancialYearById } from "../../../helper/financialYear";
import { generateVoucherNo } from "../../../helper/billNoGenerator";
import { todayIST } from "../../../helper/dateHelper";

type Id = string | number;

interface AreaManagerBody {
  areaManagerId?: Id;
  financialYearId?: Id;
  name: string;
  gender?: string | null;
  status?: string;
  mobileNumber: string;
  alternateMobile?: string | null;
  email: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
  areaId: Id;
  joiningDate: string;
  description?: string | null;
  password?: string;
  confirmPassword?: string;
}

// ---- Get company from token ----
const getCompanyIdFromToken = async (req: Request): Promise<Id | null> => {
  const token =
    (req.headers["x-token"] as string) ||
    (req.headers["X-Token"] as string) ||
    "";

  if (!token) return null;

  const rows: any[] = await selectWithJoins(
    "company",
    [],
    { token, delete: 0 },
    ["companyId"],
  );

  return rows.length ? rows[0].companyId : null;
};

// ---- Helpers ----
const toText = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value).trim();

const getCreator = (req: Request, companyId: Id) => {
  const employeeId = (req as any).employeeId as Id | undefined;

  return {
    by: employeeId ? String(employeeId) : String(companyId),
    type: employeeId ? "Employee" : "Super Admin",
  };
};

const removeUploaded = (file?: Express.Multer.File) => {
  if (file?.path) fs.unlink(file.path, () => {});
};

// Delete a stored photo, but only inside the area manager upload folder
const removeStoredFile = (storedPath?: string | null) => {
  if (!storedPath) return;
  const normalized = String(storedPath).replace(/\\/g, "/");
  if (!normalized.includes("Uploadimages/areamanager/")) return;
  fs.unlink(normalized, () => {});
};

// Full public URL for a stored upload
const toPublicUrl = (req: Request, storedPath?: string | null): string => {
  if (!storedPath) return "";
  const clean = String(storedPath).replace(/\\/g, "/").replace(/^\/+/, "");
  return `${req.protocol}://${req.get("host")}/${clean}`;
};

// Email is the login id, so it is unique across ALL companies;
// mobile number is unique inside a company.
const findDuplicate = async (
  companyId: Id,
  body: AreaManagerBody,
  excludeId?: Id,
): Promise<string | null> => {
  const skip = String(excludeId ?? "");
  const email = toText(body.email).toLowerCase();

  const sameEmail: any[] = await selectWithJoins(
    "areamanager",
    [],
    { email, delete: 0 },
    ["areaManagerId"],
  );
  if (sameEmail.some((r) => String(r.areaManagerId) !== skip)) {
    return "Email is already registered.";
  }

  // login checks employee → contractor → area manager, so the email must be free in the other two
  const inEmployee: any[] = await selectWithJoins(
    "employee",
    [],
    { officialEmail: email, delete: 0 },
    ["employeeId"],
  );
  if (inEmployee.length)
    return "This email is already used by an employee login.";

  const inContractor: any[] = await selectWithJoins(
    "contractor",
    [],
    { email, delete: 0 },
    ["contractorId"],
  );
  if (inContractor.length)
    return "This email is already used by a contractor login.";

  const rows: any[] = await selectWithJoins(
    "areamanager",
    [],
    { companyId, delete: 0 },
    ["areaManagerId", "mobileNumber"],
  );
  const mobile = toText(body.mobileNumber);
  for (const row of rows) {
    if (String(row.areaManagerId) === skip) continue;
    if (String(row.mobileNumber || "").trim() === mobile) {
      return "Mobile number is already registered.";
    }
  }
  return null;
};

// Area (region) must exist in this company; inactive only rejected when newly picked
const validateArea = async (
  companyId: Id,
  areaId: number,
  existingAreaId?: number | null,
): Promise<string | null> => {
  const rows: any[] = await selectWithJoins(
    "region",
    [],
    { regionId: areaId, companyId, delete: 0 },
    ["regionId", "status"],
  );
  if (!rows.length) return "Selected area was not found.";
  if (Number(existingAreaId) !== areaId && rows[0].status !== "Active") {
    return "Selected area is inactive.";
  }
  return null;
};

// Unique Area Manager No (prefix + FY + running number), retry on collision
const generateUniqueAreaManagerNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "areamanager",
      idColumn: "areaManagerId",
      prefixFor: "AREA_MANAGER",
      numberColumn: "areaManagerNo",
    });

    const existing: any[] = await selectWithJoins(
      "areamanager",
      [],
      { companyId, financialYearId, areaManagerNo: billNo, delete: 0 },
      ["areaManagerId"],
    );
    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
};

// ---- Next Area Manager No (drawer preview) ----
export const getNextAreaManagerNo = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const { financialYearId } = req.query as { financialYearId?: string };

    if (!financialYearId) {
      return errorResponse(
        res,
        "Financial Year not found. Please select a company year.",
      );
    }

    const fy: any = await getFinancialYearById(
      financialYearId as any,
      Number(companyId),
    );
    if (!fy) return errorResponse(res, "Invalid Financial Year.");

    const areaManagerNo = await generateUniqueAreaManagerNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!areaManagerNo) {
      return errorResponse(
        res,
        "Could not generate a unique Area Manager ID. Please try again.",
      );
    }

    return successResponse(
      res,
      {
        areaManagerNo,
        fyLabel: fy.fyLabel,
        financialYearId: fy.financialYearId,
      },
      "Area Manager ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Create (multipart: optional "profilePhoto" file) ----
export const createAreaManager = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const reject = (message: string) => {
    removeUploaded(req.file);
    return errorResponse(res, message);
  };

  try {
    const companyId = await getCompanyIdFromToken(req);
    if (!companyId) {
      removeUploaded(req.file);
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as AreaManagerBody;
    const areaId = Number(body.areaId);

    if (body.joiningDate > todayIST()) {
      return reject("Joining date cannot be in the future.");
    }

    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );
    if (!fy) return reject("Invalid Financial Year.");

    const duplicate = await findDuplicate(companyId, body);
    if (duplicate) return reject(duplicate);

    const areaError = await validateArea(companyId, areaId);
    if (areaError) return reject(areaError);

    const areaManagerNo = await generateUniqueAreaManagerNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!areaManagerNo) {
      return reject(
        "Could not generate a unique Area Manager ID. Please try again.",
      );
    }

    const creator = getCreator(req, companyId);

    const saved: any = await saveModel("areamanager", {
      companyId,
      financialYearId: fy.financialYearId,
      areaManagerNo,
      name: toText(body.name),
      profilePhoto: req.file ? req.file.path.replace(/\\/g, "/") : null,
      gender: toText(body.gender),
      mobileNumber: toText(body.mobileNumber),
      alternateMobile: toText(body.alternateMobile),
      email: toText(body.email).toLowerCase(),
      address: toText(body.address),
      city: toText(body.city),
      state: toText(body.state),
      pinCode: toText(body.pinCode),
      areaId,
      description: toText(body.description),
      joiningDate: body.joiningDate,
      password: await bcrypt.hash(String(body.password), 10),
      status: body.status || "Active",
      createdBy: creator.by,
      createdType: creator.type,
      delete: 0,
    });

    if (!saved?.areaManagerId) return reject("Failed to save area manager");

    return successResponse(
      res,
      { areaManagerId: saved.areaManagerId, areaManagerNo },
      "Area manager created successfully.",
    );
  } catch (error) {
    removeUploaded(req.file);
    console.error("createAreaManager error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List ----
export const getAreaManagerList = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(
        res,
        "Invalid or expired session. Please login again.",
      );
    }

    const rows: any[] = await selectWithJoins(
      "areamanager",
      [],
      { companyId, delete: 0 },
      [
        "areaManagerId",
        "financialYearId",
        "areaManagerNo",
        "name",
        "profilePhoto",
        "gender",
        "mobileNumber",
        "alternateMobile",
        "email",
        "address",
        "city",
        "state",
        "pinCode",
        "areaId",
        "description",
        "joiningDate",
        "loginAccess",
        "status",
        "createdBy",
        "createdType",
        "updatedBy",
        "created",
        "updated",
      ],
      [["areaManagerId", "DESC"]],
    );

    const regionRows: any[] = await selectWithJoins(
      "region",
      [],
      { companyId, delete: 0 },
      ["regionId", "regionName"],
    );
    const areaMap: Record<string, string> = {};
    regionRows.forEach((r) => {
      areaMap[String(r.regionId)] = r.regionName;
    });

    // password and token are never returned
    const data = rows.map((r) => ({
      id: String(r.areaManagerId),
      areaManagerId: r.areaManagerId,
      financialYearId: r.financialYearId,
      areaManagerNo: r.areaManagerNo || "",
      name: r.name,
      profilePhoto: r.profilePhoto || "",
      profilePhotoUrl: toPublicUrl(req, r.profilePhoto),
      gender: r.gender || "",
      mobileNumber: r.mobileNumber,
      alternateMobile: r.alternateMobile || "",
      email: r.email,
      address: r.address || "",
      city: r.city || "",
      state: r.state || "",
      pinCode: r.pinCode || "",
      areaId: String(r.areaId),
      areaName: areaMap[String(r.areaId)] || "",
      description: r.description || "",
      joiningDate: r.joiningDate || "",
      loginAccess: !!r.loginAccess,
      status: r.status,
      createdBy: r.createdBy || "",
      createdType: r.createdType || "",
      updatedBy: r.updatedBy || "",
      created: r.created,
      updated: r.updated,
    }));

    return successResponse(res, data, "Area managers fetched successfully.");
  } catch (error) {
    console.error("getAreaManagerList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update (also used for Activate / Deactivate) ----
export const updateAreaManager = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const reject = (message: string) => {
    removeUploaded(req.file);
    return errorResponse(res, message);
  };

  try {
    const companyId = await getCompanyIdFromToken(req);
    if (!companyId) {
      removeUploaded(req.file);
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as AreaManagerBody;
    const areaManagerId = Number(body.areaManagerId);
    const areaId = Number(body.areaId);

    if (body.joiningDate > todayIST()) {
      return reject("Joining date cannot be in the future.");
    }

    const existingRows: any[] = await selectWithJoins(
      "areamanager",
      [],
      { areaManagerId, companyId, delete: 0 },
      ["areaManagerId", "areaId", "profilePhoto"],
    );
    if (!existingRows.length) return reject("Area manager not found.");
    const existing = existingRows[0];

    if (body.password && body.password !== body.confirmPassword) {
      return reject("Passwords do not match.");
    }

    const duplicate = await findDuplicate(companyId, body, areaManagerId);
    if (duplicate) return reject(duplicate);

    const areaError = await validateArea(companyId, areaId, existing.areaId);
    if (areaError) return reject(areaError);

    const creator = getCreator(req, companyId);
    const status = body.status || "Active";

    // areaManagerNo, financialYearId, createdBy are not changed on update
    const values: Record<string, unknown> = {
      name: toText(body.name),
      gender: toText(body.gender),
      mobileNumber: toText(body.mobileNumber),
      alternateMobile: toText(body.alternateMobile),
      email: toText(body.email).toLowerCase(),
      address: toText(body.address),
      city: toText(body.city),
      state: toText(body.state),
      pinCode: toText(body.pinCode),
      areaId,
      description: toText(body.description),
      joiningDate: body.joiningDate,
      status,
      updatedBy: creator.by,
      updated: new Date(),
    };
    if (req.file) values.profilePhoto = req.file.path.replace(/\\/g, "/");
    if (body.password) {
      values.password = await bcrypt.hash(String(body.password), 10);
    }
    // Logout any active session when set Inactive or the password changes
    if (status !== "Active" || body.password) {
      values.token = null;
      values.tokenDate = null;
    }

    await updateModel("areamanager", values, { areaManagerId, companyId });

    // saved, so drop the replaced photo
    if (req.file) removeStoredFile(existing.profilePhoto);

    return successResponse(
      res,
      { areaManagerId },
      "Area manager updated successfully.",
    );
  } catch (error) {
    removeUploaded(req.file);
    console.error("updateAreaManager error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete (soft delete) ----
export const deleteAreaManager = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const areaManagerId = Number(
      req.body?.areaManagerId ?? (req.query as any)?.areaManagerId,
    );

    if (!areaManagerId || isNaN(areaManagerId)) {
      return requiredmessage(res, "Area manager id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "areamanager",
      [],
      { areaManagerId, companyId, delete: 0 },
      ["areaManagerId"],
    );
    if (!existing.length)
      return requiredmessage(res, "Area manager not found.");

    await updateModel(
      "areamanager",
      { delete: 1, token: null, tokenDate: null, updated: new Date() },
      { areaManagerId, companyId },
    );

    return successResponse(res, {}, "Area manager deleted successfully.");
  } catch (error) {
    console.error("deleteAreaManager error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
