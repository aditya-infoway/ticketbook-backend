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
import { generateVoucherNo } from "../../../helper/billNoGenerator";

// ---- Types ----
type Id = string | number;

interface DepartmentBody {
  departmentId?: Id;
  financialYearId?: Id;
  departmentCode: string;
  departmentName: string;
  description?: string | null;
  departmentTypeId?: Id;
  parentDepartmentId?: Id | null;
  scope: string;
  status?: string;
  displayOrder?: number | string | null;
  createdBy?: Id | null;
  createdType?: string | null;
}

interface DepartmentRow {
  departmentId: number;
  financialYearId: number;
  departmentNo: string | null;
  departmentCode: string;
  departmentName: string;
  description: string | null;
  departmentTypeId: number;
  parentDepartmentId: number | null;
  scope: string;
  status: string;
  displayOrder: number | null;
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
  value === undefined || value === null || value === ""
    ? null
    : Number(value);

// Logged-in employee ho to uska id, nahi to body ka createdBy, warna Admin
const getCreator = (
  req: Request,
  body: DepartmentBody,
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

// Department Code company me unique hona chahiye
const isCodeTaken = async (
  companyId: Id,
  code: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "department",
    [],
    { companyId, delete: 0 },
    ["departmentId", "departmentCode"],
  );

  return rows.some(
    (row) =>
      normalizeCode(row.departmentCode) === code &&
      String(row.departmentId) !== String(excludeId ?? ""),
  );
};

// Type exist karta hai + parent chain me loop nahi hai
const validateTypeAndParent = async (
  companyId: Id,
  typeId: unknown,
  parentId: number | null,
  selfId?: Id,
): Promise<string | null> => {
  const types: any[] = await selectWithJoins(
    "departmenttype",
    [],
    { departmentTypeId: typeId, companyId, delete: 0 },
    ["departmentTypeId"],
  );

  if (!types.length) return "Selected department type was not found.";

  let cursor: number | null = parentId;
  let guard = 0;

  while (cursor && guard++ < 50) {
    if (selfId !== undefined && String(cursor) === String(selfId)) {
      return "A department cannot be placed under itself or its own sub department.";
    }

    const rows: any[] = await selectWithJoins(
      "department",
      [],
      { departmentId: cursor, companyId, delete: 0 },
      ["departmentId", "parentDepartmentId"],
    );

    if (!rows.length) return "Parent department not found.";

    cursor = rows[0].parentDepartmentId;
  }

  return null;
};

// Unique Department No generate karo (collision pe retry)
const generateUniqueDepartmentNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "department",
      idColumn: "departmentId",
      prefixFor: "DEPARTMENT",
    });

    const existing: any[] = await selectWithJoins(
      "department",
      [],
      { companyId, financialYearId, departmentNo: billNo, delete: 0 },
      ["departmentId"],
    );

    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
};

// ---- Next Department No (drawer preview) ----
export const getNextDepartmentNo = async (
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

    const departmentNo = await generateUniqueDepartmentNo(
      Number(companyId),
      fy.financialYearId,
    );

    if (!departmentNo) {
      return errorResponse(
        res,
        "Could not generate a unique Department ID. Please try again.",
      );
    }

    return successResponse(
      res,
      {
        departmentNo,
        fyLabel: fy.fyLabel,
        financialYearId: fy.financialYearId,
      },
      "Department ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Create ----
export const createDepartment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as DepartmentBody;

    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );

    if (!fy) return errorResponse(res, "Invalid Financial Year.");

    const code = normalizeCode(body.departmentCode);

    if (await isCodeTaken(companyId, code)) {
      return requiredmessage(res, "Department code already exists.");
    }

    const parentId = toNumberOrNull(body.parentDepartmentId);

    const relationError = await validateTypeAndParent(
      companyId,
      body.departmentTypeId,
      parentId,
    );

    if (relationError) return errorResponse(res, relationError);

    const departmentNo = await generateUniqueDepartmentNo(
      Number(companyId),
      fy.financialYearId,
    );

    if (!departmentNo) {
      return errorResponse(
        res,
        "Could not generate a unique Department ID. Please try again.",
      );
    }

  const creator = getCreator(req, body, companyId);

    const saved: any = await saveModel("department", {
      companyId,
      financialYearId: fy.financialYearId,
      departmentNo,
      departmentCode: code,
      departmentName: String(body.departmentName || "").trim(),
      description: body.description ? String(body.description).trim() : "",
      departmentTypeId: Number(body.departmentTypeId),
      parentDepartmentId: parentId,
      scope: body.scope,
      status: body.status || "Active",
      displayOrder: toNumberOrNull(body.displayOrder),
      createdBy: creator.by,
      createdtype: creator.type,
      delete: 0,
    });

    if (!saved?.departmentId) {
      return errorResponse(res, "Failed to save department");
    }

    return successResponse(
      res,
      { departmentId: saved.departmentId, departmentNo },
      "Department created successfully.",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List ----
export const getDepartmentList = async (
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

    const rows: DepartmentRow[] = await selectWithJoins(
      "department",
      [],
      { companyId, delete: 0 },
      [
        "departmentId",
        "financialYearId",
        "departmentNo",
        "departmentCode",
        "departmentName",
        "description",
        "departmentTypeId",
        "parentDepartmentId",
        "scope",
        "status",
        "displayOrder",
        "createdBy",
        "createdtype",
        "updatedBy",
        "created",
        "updated",
      ],
      [["departmentId", "DESC"]],
    );

    if (!rows.length) {
      return successResponse(res, [], "Departments fetched successfully.");
    }

    // Type names
  const typeRows: any[] = await selectWithJoins(
  "departmenttype",
  [],
  {
    companyId,
    delete: 0,
  },
  ["departmentTypeId", "typeName"],
);

const typeMap: Record<string, string> = {};

typeRows.forEach((t) => {
  typeMap[String(t.departmentTypeId)] = t.typeName;
});

    // Parent names
    const nameMap: Record<string, string> = {};
    rows.forEach((r) => {
      nameMap[String(r.departmentId)] = r.departmentName;
    });

    // Employee names (createdBy / updatedBy numeric ho to)
    const empIds = [
      ...new Set(
        rows
          .flatMap((r) => [r.createdBy, r.updatedBy])
          .filter(
            (id): id is string =>
              Boolean(id) && id !== "Admin" && !isNaN(Number(id)),
          ),
      ),
    ];

    const empMap: Record<string, string> = {};

    if (empIds.length) {
      try {
        const emps: any[] = await selectWithJoins(
          "employee",
          [],
          { employeeId: empIds },
          ["employeeId", "employeeName"],
        );
        emps.forEach((e) => {
          empMap[String(e.employeeId)] = e.employeeName || "";
        });
      } catch (err) {
        console.error("Error fetching employees:", err);
      }
    }
// Company names (createdBy = companyId ho to)
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
   const who = (value: string | null, type?: string | null): string => {
  if (!value) return "";
  const key = String(value);
  if (type === "Employee") return empMap[key] || key;
  return companyMap[key] || empMap[key] || key;
};
    const data = rows.map((r) => ({
      id: String(r.departmentId),
      departmentId: r.departmentId,
      financialYearId: r.financialYearId,
      departmentNo: r.departmentNo || "",
      departmentCode: r.departmentCode,
      departmentName: r.departmentName,
      description: r.description || "",
      departmentTypeId: r.departmentTypeId,
typeName: typeMap[String(r.departmentTypeId)] || "",
      parentDepartmentId: r.parentDepartmentId,
      parentName: r.parentDepartmentId
        ? nameMap[String(r.parentDepartmentId)] || ""
        : "",
      scope: r.scope,
      status: r.status,
      displayOrder: r.displayOrder,
     createdBy: who(r.createdBy, r.createdtype),
updatedBy: who(r.updatedBy, r.createdtype),
      created: r.created,
      updated: r.updated,
    }));

    return successResponse(res, data, "Departments fetched successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update (status toggle bhi isi se hota hai) ----
export const updateDepartment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as DepartmentBody;
    const { departmentId } = body;

    const existing: any[] = await selectWithJoins(
      "department",
      [],
      { departmentId, companyId, delete: 0 },
      ["departmentId"],
    );

    if (!existing.length) {
      return requiredmessage(res, "Department not found.");
    }

    const code = normalizeCode(body.departmentCode);

    if (await isCodeTaken(companyId, code, departmentId)) {
      return requiredmessage(res, "Department code already exists.");
    }

    const parentId = toNumberOrNull(body.parentDepartmentId);

    const relationError = await validateTypeAndParent(
      companyId,
      body.departmentTypeId,
      parentId,
      departmentId,
    );

    if (relationError) return errorResponse(res, relationError);

  const creator = getCreator(req, body, companyId);

    // departmentNo, financialYearId, createdBy update me change nahi hote
    await updateModel(
      "department",
      {
        departmentCode: code,
        departmentName: String(body.departmentName || "").trim(),
        description: body.description ? String(body.description).trim() : "",
        departmentTypeId: Number(body.departmentTypeId),
        parentDepartmentId: parentId,
        scope: body.scope,
        status: body.status || "Active",
        displayOrder: toNumberOrNull(body.displayOrder),
        updatedBy: creator.by,
        updated: new Date(),
      },
      { departmentId, companyId },
    );

    return successResponse(res, {}, "Department updated successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete (soft delete) ----
export const deleteDepartment = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const departmentId =
      req.body?.departmentId ?? (req.query as any)?.departmentId;

    if (!departmentId) {
      return requiredmessage(res, "Department id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "department",
      [],
      { departmentId, companyId, delete: 0 },
      ["departmentId"],
    );

    if (!existing.length) {
      return requiredmessage(res, "Department not found.");
    }

    // Sub departments hon to delete nahi hoga
    const children: any[] = await selectWithJoins(
      "department",
      [],
      { parentDepartmentId: departmentId, companyId, delete: 0 },
      ["departmentId"],
    );

    if (children.length) {
      return errorResponse(
        res,
        "This department has sub departments. Delete or move them first.",
      );
    }

    await updateModel(
      "department",
      { delete: 1, updated: new Date() },
      { departmentId, companyId },
    );

    return successResponse(res, {}, "Department deleted successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};