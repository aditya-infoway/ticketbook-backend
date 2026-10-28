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

interface RoleBody {
  roleId?: Id;
  financialYearId?: Id;
  roleCode: string;
  roleName: string;
  roleCategoryId: Id;
  description?: string | null;
  defaultDataScope: string;
  departmentRestriction: string;
  departmentIds?: number[];
  status?: string;
  createdBy?: Id | null;
  createdType?: string | null;
}

interface RoleRow {
  roleId: number;
  financialYearId: number;
  roleCode: string;
  roleName: string;
  roleCategoryId: number;
  description: string | null;
  defaultDataScope: string;
  departmentRestriction: string;
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
const getCreator = (
  req: Request,
  body: RoleBody,
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

// Role Code company me unique hona chahiye
const isCodeTaken = async (
  companyId: Id,
  code: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "role",
    [],
    { companyId, delete: 0 },
    ["roleId", "roleCode"],
  );

  return rows.some(
    (row) =>
      normalizeCode(row.roleCode) === code &&
      String(row.roleId) !== String(excludeId ?? ""),
  );
};

// Category exist kare aur Active ho
const validateCategory = async (
  companyId: Id,
  roleCategoryId: number,
): Promise<string | null> => {
  const rows: any[] = await selectWithJoins(
    "rolecategory",
    [],
    { roleCategoryId, companyId, delete: 0 },
    ["roleCategoryId", "status"],
  );

  if (!rows.length) return "Selected role category was not found.";
  if (rows[0].status !== "Active") return "Selected role category is inactive.";

  return null;
};

// Saare departments company ke aur exist karte hon
const validateDepartments = async (
  companyId: Id,
  departmentIds: number[],
): Promise<string | null> => {
  if (!departmentIds.length) return null;

  const rows: any[] = await selectWithJoins(
    "department",
    [],
    { departmentId: departmentIds, companyId, delete: 0 },
    ["departmentId"],
  );

  if (rows.length !== new Set(departmentIds).size) {
    return "One or more selected departments were not found.";
  }

  return null;
};

// Role ke departments replace karo (purane soft delete, naye insert)
const syncRoleDepartments = async (
  companyId: Id,
  roleId: number,
  restriction: string,
  departmentIds: number[],
): Promise<void> => {
  await updateModel(
    "roledepartment",
    { delete: 1 },
    { roleId, companyId, delete: 0 },
  );

  if (restriction !== "selected") return;

  for (const departmentId of [...new Set(departmentIds)]) {
    await saveModel("roledepartment", {
      companyId,
      roleId,
      departmentId,
      delete: 0,
    });
  }
};

// ---- Create ----
export const createRole = async (
  req: Request,
  res: Response,
): Promise<any> => {
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

    const code = normalizeCode(body.roleCode);

    if (await isCodeTaken(companyId, code)) {
      return requiredmessage(res, "Role code already exists.");
    }

    const roleCategoryId = Number(body.roleCategoryId);

    const categoryError = await validateCategory(companyId, roleCategoryId);
    if (categoryError) return errorResponse(res, categoryError);

    const departmentIds =
      body.departmentRestriction === "selected"
        ? (body.departmentIds || []).map(Number)
        : [];

    const departmentError = await validateDepartments(companyId, departmentIds);
    if (departmentError) return errorResponse(res, departmentError);

    const creator = getCreator(req, body, companyId);

    // roleId auto-increment hai, DB khud banata hai
    const saved: any = await saveModel("role", {
      companyId,
      financialYearId: fy.financialYearId,
      roleCode: code,
      roleName: String(body.roleName || "").trim(),
      roleCategoryId,
      description: body.description ? String(body.description).trim() : "",
      defaultDataScope: body.defaultDataScope,
      departmentRestriction: body.departmentRestriction,
      status: body.status || "Active",
      createdBy: creator.by,
      createdtype: creator.type,
      delete: 0,
    });

    if (!saved?.roleId) {
      return errorResponse(res, "Failed to save role");
    }

    await syncRoleDepartments(
      companyId,
      saved.roleId,
      body.departmentRestriction,
      departmentIds,
    );

    return successResponse(
      res,
      { roleId: saved.roleId },
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
    const companyId = await getCompanyIdFromToken(req);

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
        "financialYearId",
        "roleCode",
        "roleName",
        "roleCategoryId",
        "description",
        "defaultDataScope",
        "departmentRestriction",
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

    // Category names
    const categoryRows: any[] = await selectWithJoins(
      "rolecategory",
      [],
      { companyId, delete: 0 },
      ["roleCategoryId", "roleCategoryName"],
    );

    const categoryMap: Record<string, string> = {};
    categoryRows.forEach((c) => {
      categoryMap[String(c.roleCategoryId)] = c.roleCategoryName;
    });

    // Role -> departments (mapping + names)
    const mappingRows: any[] = await selectWithJoins(
      "roledepartment",
      [],
      { companyId, delete: 0 },
      ["roleId", "departmentId"],
    );

    const departmentRows: any[] = await selectWithJoins(
      "department",
      [],
      { companyId, delete: 0 },
      ["departmentId", "departmentName"],
    );

    const departmentNameMap: Record<string, string> = {};
    departmentRows.forEach((d) => {
      departmentNameMap[String(d.departmentId)] = d.departmentName;
    });

    const roleDepartments: Record<string, number[]> = {};
    mappingRows.forEach((m) => {
      const key = String(m.roleId);
      if (!roleDepartments[key]) roleDepartments[key] = [];
      // Delete ho chuke department ko skip karo
      if (departmentNameMap[String(m.departmentId)]) {
        roleDepartments[key].push(m.departmentId);
      }
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

    const data = rows.map((r) => {
      const deptIds = roleDepartments[String(r.roleId)] || [];

      return {
        id: String(r.roleId),
        roleId: r.roleId,
        financialYearId: r.financialYearId,
        roleCode: r.roleCode,
        roleName: r.roleName,
        roleCategoryId: r.roleCategoryId,
        roleCategoryName: categoryMap[String(r.roleCategoryId)] || "",
        description: r.description || "",
        defaultDataScope: r.defaultDataScope,
        departmentRestriction: r.departmentRestriction,
        departmentIds: deptIds,
        departmentNames: deptIds.map(
          (id) => departmentNameMap[String(id)] || "",
        ),
        status: r.status,
        createdBy: who(r.createdBy),
        updatedBy: who(r.updatedBy),
        created: r.created,
        updated: r.updated,
      };
    });

    return successResponse(res, data, "Roles fetched successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update (status toggle bhi isi se hota hai) ----
export const updateRole = async (
  req: Request,
  res: Response,
): Promise<any> => {
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
      ["roleId", "roleCategoryId"],
    );

    if (!existing.length) {
      return requiredmessage(res, "Role not found.");
    }

    const code = normalizeCode(body.roleCode);

    if (await isCodeTaken(companyId, code, roleId)) {
      return requiredmessage(res, "Role code already exists.");
    }

    const roleCategoryId = Number(body.roleCategoryId);

    // Category change nahi hui to inactive category par bhi role update ho sakta hai
    if (Number(existing[0].roleCategoryId) !== roleCategoryId) {
      const categoryError = await validateCategory(companyId, roleCategoryId);
      if (categoryError) return errorResponse(res, categoryError);
    }

    const departmentIds =
      body.departmentRestriction === "selected"
        ? (body.departmentIds || []).map(Number)
        : [];

    const departmentError = await validateDepartments(companyId, departmentIds);
    if (departmentError) return errorResponse(res, departmentError);

    const creator = getCreator(req, body, companyId);

    // financialYearId, createdBy update me change nahi hote
    await updateModel(
      "role",
      {
        roleCode: code,
        roleName: String(body.roleName || "").trim(),
        roleCategoryId,
        description: body.description ? String(body.description).trim() : "",
        defaultDataScope: body.defaultDataScope,
        departmentRestriction: body.departmentRestriction,
        status: body.status || "Active",
        updatedBy: creator.by,
        updated: new Date(),
      },
      { roleId, companyId },
    );

    await syncRoleDepartments(
      companyId,
      roleId,
      body.departmentRestriction,
      departmentIds,
    );

    return successResponse(res, {}, "Role updated successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete (soft delete) ----
export const deleteRole = async (
  req: Request,
  res: Response,
): Promise<any> => {
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
    // const employees: any[] = await selectWithJoins(
    //   "employee",
    //   [],
    //   { roleId, companyId, delete: 0, status: "Active" },
    //   ["employeeId"],
    // );
    // if (employees.length) {
    //   return errorResponse(
    //     res,
    //     "This role is assigned to active employees. Reassign them first.",
    //   );
    // }

    await updateModel(
      "role",
      { delete: 1, updated: new Date() },
      { roleId, companyId },
    );

    await updateModel(
      "roledepartment",
      { delete: 1 },
      { roleId, companyId, delete: 0 },
    );

    return successResponse(res, {}, "Role deleted successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};