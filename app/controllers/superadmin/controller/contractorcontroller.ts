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

type Id = string | number;

interface ContractorBody {
  contractorId?: Id;
  financialYearId?: Id;
  contractorName: string;
  companyName?: string | null;
  mobileNumber: string;
  email?: string | null;
  specialization?: string | null;
  address?: string | null;
  areaId: Id;
  branchId: Id;
  status?: string;
  password?: string;
  confirmPassword?: string;
  existingDocuments?: string;
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

const uploadedFiles = (req: Request): Express.Multer.File[] =>
  Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];

const removeUploaded = (req: Request) => {
  uploadedFiles(req).forEach((f) => fs.unlink(f.path, () => {}));
};

// Delete a stored document, but only inside the contractor upload folder
const removeStoredFile = (storedPath: string) => {
  const normalized = String(storedPath).replace(/\\/g, "/");
  if (!normalized.includes("Uploadimages/contractor/")) return;
  fs.unlink(normalized, () => {});
};

const parseDocs = (value: unknown): string[] => {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed)
      ? parsed.filter((d) => typeof d === "string")
      : [];
  } catch {
    return [];
  }
};

// Mobile (and email, when given) must be unique inside a company
const findDuplicate = async (
  companyId: Id,
  mobile: string,
  email: string,
  excludeId?: Id,
): Promise<string | null> => {
  const rows: any[] = await selectWithJoins(
    "contractor",
    [],
    { companyId, delete: 0 },
    ["contractorId", "mobileNumber", "email"],
  );

  const wantedEmail = email.trim().toLowerCase();

  for (const row of rows) {
    if (String(row.contractorId) === String(excludeId ?? "")) continue;
    if (String(row.mobileNumber || "").trim() === mobile.trim()) {
      return "Mobile number is already registered.";
    }
    if (
      wantedEmail &&
      String(row.email || "")
        .trim()
        .toLowerCase() === wantedEmail
    ) {
      return "Email is already registered.";
    }
  }
  return null;
};

// Area (region) and branch must exist in this company; branch must be in the area.
// Inactive records are rejected only when newly picked.
const validateLinks = async (
  companyId: Id,
  areaId: number,
  branchId: number,
  existing?: { areaId?: number | null; branchId?: number | null },
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

  return null;
};

// Unique Contractor No (prefix + FY + running number), retry on collision
const generateUniqueContractorNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "contractor", // number column defaults to "contractorNo"
      idColumn: "contractorId",
      prefixFor: "CONTRACTOR",
    });

    const existing: any[] = await selectWithJoins(
      "contractor",
      [],
      { companyId, financialYearId, contractorNo: billNo, delete: 0 },
      ["contractorId"],
    );
    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
};

// ---- Register Contractor (multipart: optional "documents" files) ----
export const createContractor = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const reject = (message: string) => {
    removeUploaded(req);
    return errorResponse(res, message);
  };

  try {
    const companyId = await getCompanyIdFromToken(req);
    if (!companyId) {
      removeUploaded(req);
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as ContractorBody;
    const areaId = Number(body.areaId);
    const branchId = Number(body.branchId);

    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );
    if (!fy) return reject("Invalid Financial Year.");

    const duplicate = await findDuplicate(
      companyId,
      body.mobileNumber,
      toText(body.email),
    );
    if (duplicate) return reject(duplicate);

    const linkError = await validateLinks(companyId, areaId, branchId);
    if (linkError) return reject(linkError);

    const contractorNo = await generateUniqueContractorNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!contractorNo) {
      return reject(
        "Could not generate a unique Contractor ID. Please try again.",
      );
    }

    const creator = getCreator(req, companyId);
    const documents = uploadedFiles(req).map((f) => f.path.replace(/\\/g, "/"));

    const saved: any = await saveModel("contractor", {
      companyId,
      financialYearId: fy.financialYearId,
      contractorNo,
      contractorName: toText(body.contractorName),
      companyName: toText(body.companyName),
      mobileNumber: toText(body.mobileNumber),
      email: toText(body.email),
      specialization: toText(body.specialization),
      address: toText(body.address),
      areaId,
      branchId,
      password: await bcrypt.hash(String(body.password), 10),
      documents: JSON.stringify(documents),
      status: body.status || "Active",
      createdBy: creator.by,
      createdType: creator.type,
      delete: 0,
    });

    if (!saved?.contractorId) return reject("Failed to save contractor");

    return successResponse(
      res,
      { contractorId: saved.contractorId, contractorNo },
      "Contractor registered successfully.",
    );
  } catch (error) {
    removeUploaded(req);
    console.error("createContractor error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List Contractors ----
export const getContractorList = async (
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
      "contractor",
      [],
      { companyId, delete: 0 },
      [
        "contractorId",
        "financialYearId",
        "contractorNo",
        "contractorName",
        "companyName",
        "mobileNumber",
        "email",
        "specialization",
        "address",
        "areaId",
        "branchId",
        "documents",
        "status",
        "createdBy",
        "createdType",
        "updatedBy",
        "created",
        "updated",
      ],
      [["contractorId", "DESC"]],
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

    const [areaMap, branchMap] = await Promise.all([
      mapOf("region", "regionId", "regionName"),
      mapOf("branch", "branchId", "branchName"),
    ]);

    // password is never returned
    const data = rows.map((r) => ({
      id: String(r.contractorId),
      contractorId: r.contractorId,
      financialYearId: r.financialYearId,
      contractorNo: r.contractorNo || "",
      contractorName: r.contractorName,
      companyName: r.companyName || "",
      mobileNumber: r.mobileNumber,
      email: r.email || "",
      specialization: r.specialization || "",
      address: r.address || "",
      areaId: String(r.areaId),
      areaName: areaMap[String(r.areaId)] || "",
      branchId: String(r.branchId),
      branchName: branchMap[String(r.branchId)] || "",
      documents: parseDocs(r.documents),
      status: r.status,
      createdBy: r.createdBy || "",
      createdType: r.createdType || "",
      updatedBy: r.updatedBy || "",
      created: r.created,
      updated: r.updated,
    }));

    return successResponse(res, data, "Contractors fetched successfully.");
  } catch (error) {
    console.error("getContractorList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update Contractor (also used for Activate / Deactivate) ----
export const updateContractor = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const reject = (message: string) => {
    removeUploaded(req);
    return errorResponse(res, message);
  };

  try {
    const companyId = await getCompanyIdFromToken(req);
    if (!companyId) {
      removeUploaded(req);
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as ContractorBody;
    const contractorId = Number(body.contractorId);
    const areaId = Number(body.areaId);
    const branchId = Number(body.branchId);

    const existingRows: any[] = await selectWithJoins(
      "contractor",
      [],
      { contractorId, companyId, delete: 0 },
      ["contractorId", "areaId", "branchId", "documents"],
    );
    if (!existingRows.length) return reject("Contractor not found.");
    const existing = existingRows[0];

    if (body.password && body.password !== body.confirmPassword) {
      return reject("Passwords do not match.");
    }

    const duplicate = await findDuplicate(
      companyId,
      body.mobileNumber,
      toText(body.email),
      contractorId,
    );
    if (duplicate) return reject(duplicate);

    const linkError = await validateLinks(companyId, areaId, branchId, {
      areaId: existing.areaId,
      branchId: existing.branchId,
    });
    if (linkError) return reject(linkError);

    // Documents: keep what the drawer still lists, then add the new files.
    // No "existingDocuments" sent (e.g. status toggle) = keep all of them.
    const currentDocs = parseDocs(existing.documents);
    let keptDocs = currentDocs;
    if (body.existingDocuments !== undefined && body.existingDocuments !== "") {
      const requested = parseDocs(body.existingDocuments);
      keptDocs = currentDocs.filter((d) => requested.includes(d));
    }
    const removedDocs = currentDocs.filter((d) => !keptDocs.includes(d));
    const newDocs = uploadedFiles(req).map((f) => f.path.replace(/\\/g, "/"));

    const creator = getCreator(req, companyId);

    // contractorNo, financialYearId, createdBy are not changed on update
    const values: Record<string, unknown> = {
      contractorName: toText(body.contractorName),
      companyName: toText(body.companyName),
      mobileNumber: toText(body.mobileNumber),
      email: toText(body.email),
      specialization: toText(body.specialization),
      address: toText(body.address),
      areaId,
      branchId,
      documents: JSON.stringify([...keptDocs, ...newDocs]),
      status: body.status || "Active",
      updatedBy: creator.by,
      updated: new Date(),
    };
    if (body.password) {
      values.password = await bcrypt.hash(String(body.password), 10);
    }

    await updateModel("contractor", values, { contractorId, companyId });

    // saved, so drop the files that were removed
    removedDocs.forEach(removeStoredFile);

    return successResponse(
      res,
      { contractorId },
      "Contractor updated successfully.",
    );
  } catch (error) {
    removeUploaded(req);
    console.error("updateContractor error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete Contractor (soft delete, files are kept) ----
export const deleteContractor = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const contractorId = Number(
      req.body?.contractorId ?? (req.query as any)?.contractorId,
    );

    if (!contractorId || isNaN(contractorId)) {
      return requiredmessage(res, "Contractor id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "contractor",
      [],
      { contractorId, companyId, delete: 0 },
      ["contractorId"],
    );
    if (!existing.length) return requiredmessage(res, "Contractor not found.");

    // TODO: block delete once contractors can be linked to tickets / work.

    await updateModel(
      "contractor",
      { delete: 1, updated: new Date() },
      { contractorId, companyId },
    );

    return successResponse(res, {}, "Contractor deleted successfully.");
  } catch (error) {
    console.error("deleteContractor error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
