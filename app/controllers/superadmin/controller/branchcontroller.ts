import { Request, Response } from "express";
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

// ---- Types ----
type Id = string | number;

interface BranchBody {
  branchId?: Id;
  financialYearId?: Id;
  branchCode: string;
  branchName: string;
  regionId?: Id | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  fullAddress?: string | null;
  pinCode?: string | null;
  contactNumber?: string | null;
  phoneNumber?: string | null;
  branchEmail: string;
  password?: string | null;
  confirmPassword?: string | null;
branchManagerId?: Id | null;
areaManagerId?: Id | null;
  openingDate?: string | null;
  workingHours?: string | null;
  status?: string;
}

interface Creator {
  by: string;
  type: string;
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
const normalizeCode = (value: unknown): string =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeEmail = (value: unknown): string =>
  String(value || "")
    .trim()
    .toLowerCase();

const toNumberOrNull = (value: unknown): number | null =>
  value === undefined || value === null || value === "" ? null : Number(value);

const toText = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value).trim();

const getCreator = (req: Request, companyId: Id): Creator => {
  const employeeId = (req as any).employeeId as Id | undefined;

  return {
    by: employeeId ? String(employeeId) : String(companyId),
    type: employeeId ? "Employee" : "Super Admin",
  };
};

// Branch Code must be unique inside a company
const isCodeTaken = async (
  companyId: Id,
  code: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "branch",
    [],
    { companyId, delete: 0 },
    ["branchId", "branchCode"],
  );

  return rows.some(
    (row) =>
      normalizeCode(row.branchCode) === code &&
      String(row.branchId) !== String(excludeId ?? ""),
  );
};

// Branch Email is the login id -> unique across ALL companies
const isEmailTaken = async (
  email: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins("branch", [], { delete: 0 }, [
    "branchId",
    "branchEmail",
  ]);

  return rows.some(
    (row) =>
      normalizeEmail(row.branchEmail) === email &&
      String(row.branchId) !== String(excludeId ?? ""),
  );
};

// Region must exist in this company (if one was picked)
const validateRegion = async (
  companyId: Id,
  regionId: number | null,
): Promise<string | null> => {
  if (!regionId) return null;

  const rows: any[] = await selectWithJoins(
    "region",
    [],
    { regionId, companyId, delete: 0 },
    ["regionId"],
  );

  return rows.length ? null : "Selected region / area was not found.";
};

const checkManager = async (
  companyId: Id,
  employeeId: number | null,
  roleName: string,
): Promise<string | null> => {
  if (!employeeId) return null; // optional

  const emps: any[] = await selectWithJoins(
    "employee",
    [],
    { employeeId, companyId, employmentStatus: "Active", delete: 0 },
    ["employeeId", "roleId"],
  );
  if (!emps.length) return `Selected ${roleName} was not found or is inactive.`;

  const roles: any[] = emps[0].roleId
    ? await selectWithJoins(
        "role",
        [],
        { roleId: emps[0].roleId, companyId, delete: 0 },
        ["roleName"],
      )
    : [];

  if (
    !roles.length ||
    String(roles[0].roleName).trim().toLowerCase() !== roleName.toLowerCase()
  ) {
    return `Selected employee is not a ${roleName}.`;
  }
  return null;
};
// Unique Branch No (prefix + FY + running number), retry on collision
const generateUniqueBranchNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "branch",
      idColumn: "branchId",
      prefixFor: "BRANCH",
    });

    const existing: any[] = await selectWithJoins(
      "branch",
      [],
      { companyId, financialYearId, branchNo: billNo, delete: 0 },
      ["branchId"],
    );

    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
};

// ---- Next Branch No (drawer preview) ----
export const getNextBranchNo = async (
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

    const branchNo = await generateUniqueBranchNo(
      Number(companyId),
      fy.financialYearId,
    );

    if (!branchNo) {
      return errorResponse(
        res,
        "Could not generate a unique Branch ID. Please try again.",
      );
    }

    return successResponse(
      res,
      { branchNo, fyLabel: fy.fyLabel, financialYearId: fy.financialYearId },
      "Branch ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Create Branch ----
export const createBranch = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as BranchBody;

    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );
    if (!fy) return errorResponse(res, "Invalid Financial Year.");

    const code = normalizeCode(body.branchCode);
    if (await isCodeTaken(companyId, code)) {
      return requiredmessage(res, "Branch code already exists.");
    }

    const email = normalizeEmail(body.branchEmail);
    if (await isEmailTaken(email)) {
      return requiredmessage(res, "Branch email already exists.");
    }

    const regionId = toNumberOrNull(body.regionId);
    const regionError = await validateRegion(companyId, regionId);
    if (regionError) return errorResponse(res, regionError);

const branchManagerId = toNumberOrNull(body.branchManagerId);
const areaManagerId = toNumberOrNull(body.areaManagerId);

const managerError =
  (await checkManager(companyId, branchManagerId, "Branch Manager")) ||
  (await checkManager(companyId, areaManagerId, "Area Manager"));
if (managerError) return errorResponse(res, managerError);
    const branchNo = await generateUniqueBranchNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!branchNo) {
      return errorResponse(
        res,
        "Could not generate a unique Branch ID. Please try again.",
      );
    }

    const creator = getCreator(req, companyId);
    const passwordHash = await bcrypt.hash(String(body.password), 10);

    const saved: any = await saveModel("branch", {
      companyId,
      financialYearId: fy.financialYearId,
      branchNo,
      branchCode: code,
      branchName: toText(body.branchName),
      regionId,
      country: toText(body.country),
      state: toText(body.state),
      city: toText(body.city),
      fullAddress: toText(body.fullAddress),
      pinCode: toText(body.pinCode),
      contactNumber: toText(body.contactNumber),
      phoneNumber: toText(body.phoneNumber),
      branchEmail: email,
      password: passwordHash,
 branchManagerId,
areaManagerId,
      openingDate: body.openingDate ? body.openingDate : null,
      workingHours: toText(body.workingHours),
      status: body.status || "Active",
      createdBy: creator.by,
      createdType: creator.type,
      delete: 0,
    });

    if (!saved?.branchId) {
      return errorResponse(res, "Failed to save branch");
    }

    return successResponse(
      res,
      { branchId: saved.branchId, branchNo },
      "Branch created successfully.",
    );
  } catch (error) {
    console.error("createBranch error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List Branches (password is never returned) ----
export const getBranchList = async (
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
      "branch",
      [],
      { companyId, delete: 0 },
      [
        "branchId",
        "financialYearId",
        "branchNo",
        "branchCode",
        "branchName",
        "regionId",
        "country",
        "state",
        "city",
        "fullAddress",
        "pinCode",
        "contactNumber",
        "phoneNumber",
        "branchEmail",
       "branchManagerId",
        "areaManagerId",
        "openingDate",
        "workingHours",
        "status",
        "createdBy",
        "createdType",
        "updatedBy",
        "created",
        "updated",
      ],
      [["branchId", "DESC"]],
    );

    if (!rows.length) {
      return successResponse(res, [], "Branches fetched successfully.");
    }

    // Region names for the table
    const regionRows: any[] = await selectWithJoins(
      "region",
      [],
      { companyId, delete: 0 },
      ["regionId", "regionName"],
    );

    const regionMap: Record<string, string> = {};
    regionRows.forEach((r) => {
      regionMap[String(r.regionId)] = r.regionName || "";
    });
const empRows: any[] = await selectWithJoins(
  "employee",
  [],
  { companyId, delete: 0 },
  ["employeeId", "employeeName"],
);
const empMap: Record<string, string> = {};
empRows.forEach((e) => {
  empMap[String(e.employeeId)] = e.employeeName;
});
    const data = rows.map((r) => ({
      id: String(r.branchId),
      branchId: r.branchId,
      financialYearId: r.financialYearId,
      branchNo: r.branchNo || "",
      branchCode: r.branchCode,
      branchName: r.branchName,
      regionId: r.regionId,
      region: r.regionId ? regionMap[String(r.regionId)] || "" : "",
      country: r.country || "",
      state: r.state || "",
      city: r.city || "",
      fullAddress: r.fullAddress || "",
      pinCode: r.pinCode || "",
      contactNumber: r.contactNumber || "",
      phoneNumber: r.phoneNumber || "",
      branchEmail: r.branchEmail,
    branchManagerId: r.branchManagerId ?? null,
areaManagerId: r.areaManagerId ?? null,
branchManager: r.branchManagerId ? empMap[String(r.branchManagerId)] || "" : "",
areaManager: r.areaManagerId ? empMap[String(r.areaManagerId)] || "" : "",
      openingDate: r.openingDate || "",
      workingHours: r.workingHours || "",
      status: r.status,
      createdBy: r.createdBy || "",
      createdType: r.createdType || "",
      updatedBy: r.updatedBy || "",
      created: r.created,
      updated: r.updated,
    }));

    return successResponse(res, data, "Branches fetched successfully.");
  } catch (error) {
    console.error("getBranchList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update Branch (also used for Activate / Deactivate) ----
export const updateBranch = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as BranchBody;
    const { branchId } = body;

   const existing: any[] = await selectWithJoins(
  "branch",
  [],
  { branchId, companyId, delete: 0 },
  ["branchId", "branchManagerId", "areaManagerId"],
);
    if (!existing.length) return requiredmessage(res, "Branch not found.");

    const code = normalizeCode(body.branchCode);
    if (await isCodeTaken(companyId, code, branchId)) {
      return requiredmessage(res, "Branch code already exists.");
    }

    const email = normalizeEmail(body.branchEmail);
    if (await isEmailTaken(email, branchId)) {
      return requiredmessage(res, "Branch email already exists.");
    }

    const regionId = toNumberOrNull(body.regionId);
    const regionError = await validateRegion(companyId, regionId);
    if (regionError) return errorResponse(res, regionError);
const branchManagerId = toNumberOrNull(body.branchManagerId);
const areaManagerId = toNumberOrNull(body.areaManagerId);

const managerError =
  (branchManagerId !== (existing[0].branchManagerId ?? null)
    ? await checkManager(companyId, branchManagerId, "Branch Manager")
    : null) ||
  (areaManagerId !== (existing[0].areaManagerId ?? null)
    ? await checkManager(companyId, areaManagerId, "Area Manager")
    : null);
if (managerError) return errorResponse(res, managerError);
    const creator = getCreator(req, companyId);

    // branchNo, financialYearId, createdBy are not changed on update
    const updatePayload: Record<string, any> = {
      branchCode: code,
      branchName: toText(body.branchName),
      regionId,
      country: toText(body.country),
      state: toText(body.state),
      city: toText(body.city),
      fullAddress: toText(body.fullAddress),
      pinCode: toText(body.pinCode),
      contactNumber: toText(body.contactNumber),
      phoneNumber: toText(body.phoneNumber),
      branchEmail: email,
    branchManagerId,
areaManagerId,
      openingDate: body.openingDate ? body.openingDate : null,
      workingHours: toText(body.workingHours),
      status: body.status || "Active",
      updatedBy: creator.by,
      updated: new Date(),
    };

    // Only change the password when a new one was typed
    if (body.password) {
      updatePayload.password = await bcrypt.hash(String(body.password), 10);
    }

    await updateModel("branch", updatePayload, { branchId, companyId });

    return successResponse(res, {}, "Branch updated successfully.");
  } catch (error) {
    console.error("updateBranch error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete Branch (soft delete) ----
export const deleteBranch = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const branchId = req.body?.branchId ?? (req.query as any)?.branchId;

    if (!branchId) return requiredmessage(res, "Branch id is required.");

    const existing: any[] = await selectWithJoins(
      "branch",
      [],
      { branchId, companyId, delete: 0 },
      ["branchId"],
    );
    if (!existing.length) return requiredmessage(res, "Branch not found.");

    await updateModel(
      "branch",
      { delete: 1, updated: new Date() },
      { branchId, companyId },
    );

    return successResponse(res, {}, "Branch deleted successfully.");
  } catch (error) {
    console.error("deleteBranch error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
