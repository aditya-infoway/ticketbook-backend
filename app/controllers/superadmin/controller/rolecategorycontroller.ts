import { Request, Response } from "express";

import {
  errorResponse,
  successResponse,
  requiredmessage,
  saveModel,
  updateModel,
  selectWithJoins,
} from "../../../helper/index";
import { getFinancialYearById } from "../../../helper/financialYear";

// ---- Types ----
type Id = string | number;

interface RoleCategoryBody {
  roleCategoryId?: Id;
  financialYearId?: Id;
  roleCategoryCode: string;
  roleCategoryName: string;
  description?: string | null;
  displayOrder?: number | string | null;
  status?: string;
  createdBy?: Id | null;
  createdType?: string | null;
}

interface RoleCategoryRow {
  roleCategoryId: number;
  financialYearId: number;
  roleCategoryCode: string;
  roleCategoryName: string;
  description: string | null;
  displayOrder: number | null;
  status: string;
  createdBy: string | null;
  createdtype: string | null;
  updatedBy: string | null;
  created: Date;
  updated: Date;
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

const toNumberOrNull = (value: unknown): number | null =>
  value === undefined || value === null || value === "" ? null : Number(value);

// Logged-in employee ho to uska id, nahi to body ka createdBy, warna companyId
const getCreator = (
  req: Request,
  body: RoleCategoryBody,
  companyId: Id,
): Creator => {
  const employeeId = (req as any).employeeId as Id | undefined;

  return {
    by: employeeId
      ? String(employeeId)
      : body.createdBy
        ? String(body.createdBy)
        : String(companyId),
    type: employeeId ? "Employee" : body.createdType || "Super Admin",
  };
};

// Role Category Code company me unique hona chahiye
const isCodeTaken = async (
  companyId: Id,
  code: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "rolecategory",
    [],
    { companyId, delete: 0 },
    ["roleCategoryId", "roleCategoryCode"],
  );

  return rows.some(
    (row) =>
      normalizeCode(row.roleCategoryCode) === code &&
      String(row.roleCategoryId) !== String(excludeId ?? ""),
  );
};

// ---- Create ----
export const createRoleCategory = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as RoleCategoryBody;

    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );

    if (!fy) return errorResponse(res, "Invalid Financial Year.");

    const code = normalizeCode(body.roleCategoryCode);

    if (await isCodeTaken(companyId, code)) {
      return requiredmessage(res, "Role category code already exists.");
    }

    const creator = getCreator(req, body, companyId);

    // roleCategoryId auto-increment hai, DB khud banata hai
    const saved: any = await saveModel("rolecategory", {
      companyId,
      financialYearId: fy.financialYearId,
      roleCategoryCode: code,
      roleCategoryName: String(body.roleCategoryName || "").trim(),
      description: body.description ? String(body.description).trim() : "",
      displayOrder: toNumberOrNull(body.displayOrder),
      status: body.status || "Active",
      createdBy: creator.by,
      createdtype: creator.type,
      delete: 0,
    });

    if (!saved?.roleCategoryId) {
      return errorResponse(res, "Failed to save role category");
    }

    return successResponse(
      res,
      { roleCategoryId: saved.roleCategoryId },
      "Role category created successfully.",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List ----
export const getRoleCategoryList = async (
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

    const rows = (await selectWithJoins(
      "rolecategory",
      [],
      { companyId, delete: 0 },
      [
        "roleCategoryId",
        "financialYearId",
        "roleCategoryCode",
        "roleCategoryName",
        "description",
        "displayOrder",
        "status",
        "createdBy",
        "createdtype",
        "updatedBy",
        "created",
        "updated",
      ],
    )) as unknown as RoleCategoryRow[];

    if (!rows.length) {
      return successResponse(res, [], "Role categories fetched successfully.");
    }

    // Display Order ASC, khali (null) sabse end me, phir Name A-Z
    // (JS me sort kiya taaki MySQL / PostgreSQL dono me NULL ka behaviour same rahe)
    rows.sort((a, b) => {
      const x = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const y = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
      if (x !== y) return x - y;
      return a.roleCategoryName.localeCompare(b.roleCategoryName);
    });

    // Company names (createdBy / updatedBy = companyId ho to)
    const companyMap: Record<string, string> = {};
    const compIds = [
      ...new Set(
        rows
          .flatMap((r) => [r.createdBy, r.updatedBy])
          .filter((id): id is string => Boolean(id) && !isNaN(Number(id))),
      ),
    ];

    if (compIds.length) {
      try {
        const comps: any[] = await selectWithJoins(
          "company",
          [],
          { companyId: compIds, delete: 0 },
          ["companyId", "companyName"],
        );
        comps.forEach((c) => {
          companyMap[String(c.companyId)] = c.companyName || "";
        });
      } catch (err) {
        console.error("Error fetching companies:", err);
      }
    }

    const who = (value: string | null): string => {
      if (!value) return "";
      return companyMap[String(value)] || String(value);
    };

    const data = rows.map((r) => ({
      id: String(r.roleCategoryId),
      roleCategoryId: r.roleCategoryId,
      financialYearId: r.financialYearId,
      roleCategoryCode: r.roleCategoryCode,
      roleCategoryName: r.roleCategoryName,
      description: r.description || "",
      displayOrder: r.displayOrder,
      status: r.status,
      createdBy: who(r.createdBy),
      updatedBy: who(r.updatedBy),
      created: r.created,
      updated: r.updated,
    }));

    return successResponse(res, data, "Role categories fetched successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update (status toggle bhi isi se hota hai) ----
export const updateRoleCategory = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as RoleCategoryBody;
    const roleCategoryId = Number(body.roleCategoryId);

    const existing: any[] = await selectWithJoins(
      "rolecategory",
      [],
      { roleCategoryId, companyId, delete: 0 },
      ["roleCategoryId"],
    );

    if (!existing.length) {
      return requiredmessage(res, "Role category not found.");
    }

    const code = normalizeCode(body.roleCategoryCode);

    if (await isCodeTaken(companyId, code, roleCategoryId)) {
      return requiredmessage(res, "Role category code already exists.");
    }

    const creator = getCreator(req, body, companyId);

    // financialYearId, createdBy update me change nahi hote
    await updateModel(
      "rolecategory",
      {
        roleCategoryCode: code,
        roleCategoryName: String(body.roleCategoryName || "").trim(),
        description: body.description ? String(body.description).trim() : "",
        displayOrder: toNumberOrNull(body.displayOrder),
        status: body.status || "Active",
        updatedBy: creator.by,
        updated: new Date(),
      },
      { roleCategoryId, companyId },
    );

    return successResponse(res, {}, "Role category updated successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete (soft delete) ----
export const deleteRoleCategory = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const roleCategoryId = Number(
      req.body?.roleCategoryId ?? (req.query as any)?.roleCategoryId,
    );

    if (!roleCategoryId || isNaN(roleCategoryId)) {
      return requiredmessage(res, "Role category id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "rolecategory",
      [],
      { roleCategoryId, companyId, delete: 0 },
      ["roleCategoryId"],
    );

    if (!existing.length) {
      return requiredmessage(res, "Role category not found.");
    }

    // Role me use ho rahi category delete nahi hogi
    const roles: any[] = await selectWithJoins(
      "role",
      [],
      { roleCategoryId, companyId, delete: 0 },
      ["roleId"],
    );

    if (roles.length) {
      return errorResponse(
        res,
        "This category is used by roles. Delete or move them first.",
      );
    }

    await updateModel(
      "rolecategory",
      { delete: 1, updated: new Date() },
      { roleCategoryId, companyId },
    );

    return successResponse(res, {}, "Role category deleted successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};