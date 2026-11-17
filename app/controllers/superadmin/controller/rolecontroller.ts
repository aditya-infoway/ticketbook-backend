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
import { getCompanyIdFromAnyToken } from "../../../helper/tokenHelper";
import { generateVoucherNo } from "../../../helper/billNoGenerator";

// ---- Types ----
type Id = string | number;

interface RoleBody {
  roleId?: Id;
  financialYearId?: Id;
  roleName: string;
  status?: string;
  createdBy?: Id | null;
  createdType?: string | null;
}

interface RoleRow {
  roleId: number;
  roleNo: string | null;
  financialYearId: number;
  roleName: string;
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

// Logged-in employee ho to uska id, nahi to body ka createdBy, warna companyId
const getCreator = (req: Request, body: RoleBody, companyId: Id): Creator => {
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

// Role Name company me unique hona chahiye
const isNameTaken = async (
  companyId: Id,
  name: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "role",
    [],
    { companyId, delete: 0 },
    ["roleId", "roleName"],
  );

  return rows.some(
    (row) =>
      String(row.roleName || "")
        .trim()
        .toLowerCase() === name.toLowerCase() &&
      String(row.roleId) !== String(excludeId ?? ""),
  );
};

// Unique Role No (prefix + FY + running number), retry on collision
const generateUniqueRoleNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "role",
      idColumn: "roleId",
      prefixFor: "ROLE",
    });

    const existing: any[] = await selectWithJoins(
      "role",
      [],
      { companyId, financialYearId, roleNo: billNo, delete: 0 },
      ["roleId"],
    );

    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
};

// ---- Next Role No (drawer preview) ----
export const getNextRoleNo = async (
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

    const roleNo = await generateUniqueRoleNo(
      Number(companyId),
      fy.financialYearId,
    );

    if (!roleNo) {
      return errorResponse(
        res,
        "Could not generate a unique Role ID. Please try again.",
      );
    }

    return successResponse(
      res,
      { roleNo, fyLabel: fy.fyLabel, financialYearId: fy.financialYearId },
      "Role ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Create ----
export const createRole = async (req: Request, res: Response): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as RoleBody;

    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );

    if (!fy) return errorResponse(res, "Invalid Financial Year.");

    const roleName = String(body.roleName || "").trim();
    if (await isNameTaken(companyId, roleName)) {
      return requiredmessage(res, "Role name already exists.");
    }
    const creator = getCreator(req, body, companyId);

    const roleNo = await generateUniqueRoleNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!roleNo) {
      return errorResponse(
        res,
        "Could not generate a unique Role ID. Please try again.",
      );
    }

    // roleId auto-increment hai, DB khud banata hai
    const saved: any = await saveModel("role", {
      companyId,
      financialYearId: fy.financialYearId,
      roleNo,
      roleName,
      status: body.status || "Active",
      createdBy: creator.by,
      createdtype: creator.type,
      delete: 0,
    });

    if (!saved?.roleId) {
      return errorResponse(res, "Failed to save role");
    }

    return successResponse(
      res,
      { roleId: saved.roleId, roleNo },
      "Role created successfully.",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List ----
export const getRoleList = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromAnyToken(req);

    if (!companyId) {
      return requiredmessage(
        res,
        "Invalid or expired session. Please login again.",
      );
    }

    const rows = (await selectWithJoins(
      "role",
      [],
      { companyId, delete: 0 },
      [
        "roleId",
        "roleNo",
        "financialYearId",
        "roleName",
        "status",
        "createdBy",
        "createdtype",
        "updatedBy",
        "created",
        "updated",
      ],
      [["roleId", "DESC"]],
    )) as unknown as RoleRow[];

    if (!rows.length) {
      return successResponse(res, [], "Roles fetched successfully.");
    }

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
      id: String(r.roleId),
      roleId: r.roleId,
      roleNo: r.roleNo || "",
      financialYearId: r.financialYearId,
      roleName: r.roleName,
      status: r.status,
      createdBy: who(r.createdBy),
      updatedBy: who(r.updatedBy),
      created: r.created,
      updated: r.updated,
    }));

    return successResponse(res, data, "Roles fetched successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update (status toggle bhi isi se hota hai) ----
export const updateRole = async (req: Request, res: Response): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as RoleBody;
    const roleId = Number(body.roleId);

    const existing: any[] = await selectWithJoins(
      "role",
      [],
      { roleId, companyId, delete: 0 },
      ["roleId"],
    );

    if (!existing.length) {
      return requiredmessage(res, "Role not found.");
    }

    const roleName = String(body.roleName || "").trim();
    if (await isNameTaken(companyId, roleName, roleId)) {
      return requiredmessage(res, "Role name already exists.");
    }
    const creator = getCreator(req, body, companyId);

    // financialYearId, createdBy update me change nahi hote
    await updateModel(
      "role",
      {
        roleName: String(body.roleName || "").trim(),
        status: body.status || "Active",
        updatedBy: creator.by,
        updated: new Date(),
      },
      { roleId, companyId },
    );

    return successResponse(res, {}, "Role updated successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete (soft delete) ----
export const deleteRole = async (req: Request, res: Response): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const roleId = Number(req.body?.roleId ?? (req.query as any)?.roleId);

    if (!roleId || isNaN(roleId)) {
      return requiredmessage(res, "Role id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "role",
      [],
      { roleId, companyId, delete: 0 },
      ["roleId"],
    );

    if (!existing.length) {
      return requiredmessage(res, "Role not found.");
    }

    // TODO: Employee module banne ke baad ye check on kar dena
    const employees: any[] = await selectWithJoins(
      "employee",
      [],
      { roleId, companyId, delete: 0 },
      ["employeeId"],
    );
    if (employees.length) {
      return errorResponse(
        res,
        "This role is assigned to employees. Reassign them first.",
      );
    }

    await updateModel(
      "role",
      { delete: 1, updated: new Date() },
      { roleId, companyId },
    );


    return successResponse(res, {}, "Role deleted successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};
