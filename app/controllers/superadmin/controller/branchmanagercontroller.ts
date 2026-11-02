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

interface BranchManagerBody {
  branchManagerId?: Id;
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
  branchId: Id;
  reportingTo: Id;
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

// Delete a stored photo, but only inside the branch manager upload folder
const removeStoredFile = (storedPath?: string | null) => {
  if (!storedPath) return;
  const normalized = String(storedPath).replace(/\\/g, "/");
  if (!normalized.includes("Uploadimages/branchmanager/")) return;
  fs.unlink(normalized, () => {});
};

// Full public URL for a stored upload
const toPublicUrl = (req: Request, storedPath?: string | null): string => {
  if (!storedPath) return "";
  const clean = String(storedPath).replace(/\\/g, "/").replace(/^\/+/, "");
  return `${req.protocol}://${req.get("host")}/${clean}`;
};

// Email is the login id: unique across ALL companies, and it must not match
// a Branch login email (the branch login checks branches first).
// Mobile is unique inside a company; a branch can have only one manager.
const findDuplicate = async (
  companyId: Id,
  body: BranchManagerBody,
  excludeId?: Id,
): Promise<string | null> => {
  const skip = String(excludeId ?? "");
  const email = toText(body.email).toLowerCase();

  const sameEmail: any[] = await selectWithJoins(
    "branchmanager",
    [],
    { email, delete: 0 },
    ["branchManagerId"],
  );
  if (sameEmail.some((r) => String(r.branchManagerId) !== skip)) {
    return "Email is already registered.";
  }

  const inBranch: any[] = await selectWithJoins(
    "branch",
    [],
    { branchEmail: email, delete: 0 },
    ["branchId"],
  );
  if (inBranch.length) return "This email is already used as a branch login.";

  const rows: any[] = await selectWithJoins(
    "branchmanager",
    [],
    { companyId, delete: 0 },
    ["branchManagerId", "mobileNumber", "branchId"],
  );
  const mobile = toText(body.mobileNumber);
  const branchId = Number(body.branchId);

  for (const row of rows) {
    if (String(row.branchManagerId) === skip) continue;
    if (String(row.mobileNumber || "").trim() === mobile) {
      return "Mobile number is already registered.";
    }
    if (Number(row.branchId) === branchId) {
      return "This branch already has a branch manager.";
    }
  }
  return null;
};

// Area, branch and reporting area manager must exist in this company and match each other.
// Inactive records are rejected only when newly picked.
const validateLinks = async (
  companyId: Id,
  areaId: number,
  branchId: number,
  reportingTo: number,
  existing?: {
    areaId?: number | null;
    branchId?: number | null;
    reportingTo?: number | null;
  },
): Promise<string | null> => {
  const regionRows: any[] = await selectWithJoins(
    "region",
    [],
    { regionId: areaId, companyId, delete: 0 },
    ["regionId", "status"],
  );
  if (!regionRows.length) return "Selected area was not found.";
  if (
    Number(existing?.areaId) !== areaId &&
    regionRows[0].status !== "Active"
  ) {
    return "Selected area is inactive.";
  }

  const branchRows: any[] = await selectWithJoins(
    "branch",
    [],
    { branchId, companyId, delete: 0 },
    ["branchId", "regionId", "status"],
  );
  if (!branchRows.length) return "Selected branch was not found.";
  if (
    Number(existing?.branchId) !== branchId &&
    branchRows[0].status !== "Active"
  ) {
    return "Selected branch is inactive.";
  }
  if (Number(branchRows[0].regionId) !== areaId) {
    return "Selected branch does not belong to the selected area.";
  }

  const managerRows: any[] = await selectWithJoins(
    "areamanager",
    [],
    { areaManagerId: reportingTo, companyId, delete: 0 },
    ["areaManagerId", "areaId", "status"],
  );
  if (!managerRows.length) return "Selected area manager was not found.";
  if (
    Number(existing?.reportingTo) !== reportingTo &&
    managerRows[0].status !== "Active"
  ) {
    return "Selected area manager is inactive.";
  }
  if (Number(managerRows[0].areaId) !== areaId) {
    return "Selected area manager does not belong to the selected area.";
  }

  return null;
};

// Unique Branch Manager No (prefix + FY + running number), retry on collision
const generateUniqueBranchManagerNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "branchmanager",
      idColumn: "branchManagerId",
      prefixFor: "BRANCH_MANAGER",
      numberColumn: "branchManagerNo",
    });

    const existing: any[] = await selectWithJoins(
      "branchmanager",
      [],
      { companyId, financialYearId, branchManagerNo: billNo, delete: 0 },
      ["branchManagerId"],
    );
    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
};

// ---- Next Branch Manager No (drawer preview) ----
export const getNextBranchManagerNo = async (
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

    const branchManagerNo = await generateUniqueBranchManagerNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!branchManagerNo) {
      return errorResponse(
        res,
        "Could not generate a unique Branch Manager ID. Please try again.",
      );
    }

    return successResponse(
      res,
      {
        branchManagerNo,
        fyLabel: fy.fyLabel,
        financialYearId: fy.financialYearId,
      },
      "Branch Manager ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Create (multipart: optional "profilePhoto" file) ----
export const createBranchManager = async (
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

    const body = req.body as BranchManagerBody;
    const areaId = Number(body.areaId);
    const branchId = Number(body.branchId);
    const reportingTo = Number(body.reportingTo);

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

    const linkError = await validateLinks(
      companyId,
      areaId,
      branchId,
      reportingTo,
    );
    if (linkError) return reject(linkError);

    const branchManagerNo = await generateUniqueBranchManagerNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!branchManagerNo) {
      return reject(
        "Could not generate a unique Branch Manager ID. Please try again.",
      );
    }

    const creator = getCreator(req, companyId);

    const saved: any = await saveModel("branchmanager", {
      companyId,
      financialYearId: fy.financialYearId,
      branchManagerNo,
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
      branchId,
      reportingTo,
      description: toText(body.description),
      joiningDate: body.joiningDate,
      password: await bcrypt.hash(String(body.password), 10),
      status: body.status || "Active",
      createdBy: creator.by,
      createdType: creator.type,
      delete: 0,
    });

    if (!saved?.branchManagerId) return reject("Failed to save branch manager");

    return successResponse(
      res,
      { branchManagerId: saved.branchManagerId, branchManagerNo },
      "Branch manager created successfully.",
    );
  } catch (error) {
    removeUploaded(req.file);
    console.error("createBranchManager error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List ----
export const getBranchManagerList = async (
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
      "branchmanager",
      [],
      { companyId, delete: 0 },
      [
        "branchManagerId",
        "financialYearId",
        "branchManagerNo",
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
        "branchId",
        "reportingTo",
        "description",
        "joiningDate",
        "status",
        "createdBy",
        "createdType",
        "updatedBy",
        "created",
        "updated",
      ],
      [["branchManagerId", "DESC"]],
    );

    const mapOf = async (
      table: string,
      idCol: string,
      nameCol: string,
    ): Promise<Record<string, string>> => {
      const list: any[] = await selectWithJoins(
        table,
        [],
        { companyId, delete: 0 },
        [idCol, nameCol],
      );
      const map: Record<string, string> = {};
      list.forEach((r) => {
        map[String(r[idCol])] = r[nameCol];
      });
      return map;
    };

    const [areaMap, branchMap, managerMap] = await Promise.all([
      mapOf("region", "regionId", "regionName"),
      mapOf("branch", "branchId", "branchName"),
      mapOf("areamanager", "areaManagerId", "name"),
    ]);

    // password and token are never returned
    const data = rows.map((r) => ({
      id: String(r.branchManagerId),
      branchManagerId: r.branchManagerId,
      financialYearId: r.financialYearId,
      branchManagerNo: r.branchManagerNo || "",
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
      branchId: String(r.branchId),
      branchName: branchMap[String(r.branchId)] || "",
      reportingTo: String(r.reportingTo),
      reportingToName: managerMap[String(r.reportingTo)] || "",
      description: r.description || "",
      joiningDate: r.joiningDate || "",
      status: r.status,
      createdBy: r.createdBy || "",
      createdType: r.createdType || "",
      updatedBy: r.updatedBy || "",
      created: r.created,
      updated: r.updated,
    }));

    return successResponse(res, data, "Branch managers fetched successfully.");
  } catch (error) {
    console.error("getBranchManagerList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update (also used for Activate / Deactivate) ----
export const updateBranchManager = async (
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

    const body = req.body as BranchManagerBody;
    const branchManagerId = Number(body.branchManagerId);
    const areaId = Number(body.areaId);
    const branchId = Number(body.branchId);
    const reportingTo = Number(body.reportingTo);

    if (body.joiningDate > todayIST()) {
      return reject("Joining date cannot be in the future.");
    }

    const existingRows: any[] = await selectWithJoins(
      "branchmanager",
      [],
      { branchManagerId, companyId, delete: 0 },
      ["branchManagerId", "areaId", "branchId", "reportingTo", "profilePhoto"],
    );
    if (!existingRows.length) return reject("Branch manager not found.");
    const existing = existingRows[0];

    if (body.password && body.password !== body.confirmPassword) {
      return reject("Passwords do not match.");
    }

    const duplicate = await findDuplicate(companyId, body, branchManagerId);
    if (duplicate) return reject(duplicate);

    const linkError = await validateLinks(
      companyId,
      areaId,
      branchId,
      reportingTo,
      {
        areaId: existing.areaId,
        branchId: existing.branchId,
        reportingTo: existing.reportingTo,
      },
    );
    if (linkError) return reject(linkError);

    const creator = getCreator(req, companyId);
    const status = body.status || "Active";

    // branchManagerNo, financialYearId, createdBy are not changed on update
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
      branchId,
      reportingTo,
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

    await updateModel("branchmanager", values, { branchManagerId, companyId });

    // saved, so drop the replaced photo
    if (req.file) removeStoredFile(existing.profilePhoto);

    return successResponse(
      res,
      { branchManagerId },
      "Branch manager updated successfully.",
    );
  } catch (error) {
    removeUploaded(req.file);
    console.error("updateBranchManager error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete (soft delete) ----
export const deleteBranchManager = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const branchManagerId = Number(
      req.body?.branchManagerId ?? (req.query as any)?.branchManagerId,
    );

    if (!branchManagerId || isNaN(branchManagerId)) {
      return requiredmessage(res, "Branch manager id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "branchmanager",
      [],
      { branchManagerId, companyId, delete: 0 },
      ["branchManagerId"],
    );
    if (!existing.length)
      return requiredmessage(res, "Branch manager not found.");

    await updateModel(
      "branchmanager",
      { delete: 1, token: null, tokenDate: null, updated: new Date() },
      { branchManagerId, companyId },
    );

    return successResponse(res, {}, "Branch manager deleted successfully.");
  } catch (error) {
    console.error("deleteBranchManager error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
