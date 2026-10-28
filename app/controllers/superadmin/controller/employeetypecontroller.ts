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

interface EmployeeTypeBody {
  employeeTypeId?: Id;
  financialYearId?: Id;
  typeCode: string;
  typeName: string;
  description?: string | null;
  displayOrder?: number | string | null;
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

const toNumberOrNull = (value: unknown): number | null =>
  value === undefined || value === null || value === "" ? null : Number(value);

const getCreator = (req: Request, companyId: Id): Creator => {
  const employeeId = (req as any).employeeId as Id | undefined;

  return {
    by: employeeId ? String(employeeId) : String(companyId),
    type: employeeId ? "Employee" : "Super Admin",
  };
};

// Type Code must be unique inside a company (case-insensitive)
const isTypeCodeTaken = async (
  companyId: Id,
  typeCode: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "employeetype",
    [],
    { companyId, delete: 0 },
    ["employeeTypeId", "typeCode"],
  );

  return rows.some(
    (row) =>
      normalizeCode(row.typeCode) === typeCode &&
      String(row.employeeTypeId) !== String(excludeId ?? ""),
  );
};

// Unique Employee Type No (prefix + FY + running number), retry on collision
const generateUniqueEmployeeTypeNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "employeetype",
      idColumn: "employeeTypeId",
      prefixFor: "EMPLOYEE_TYPE",
    });

    const existing: any[] = await selectWithJoins(
      "employeetype",
      [],
      { companyId, financialYearId, employeeTypeNo: billNo, delete: 0 },
      ["employeeTypeId"],
    );

    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
};

// ---- Next Employee Type No (drawer preview) ----
export const getNextEmployeeTypeNo = async (
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

    const employeeTypeNo = await generateUniqueEmployeeTypeNo(
      Number(companyId),
      fy.financialYearId,
    );

    if (!employeeTypeNo) {
      return errorResponse(
        res,
        "Could not generate a unique Type ID. Please try again.",
      );
    }

    return successResponse(
      res,
      {
        employeeTypeNo,
        fyLabel: fy.fyLabel,
        financialYearId: fy.financialYearId,
      },
      "Type ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Create Employee Type ----
export const createEmployeeType = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as EmployeeTypeBody;

    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );
    if (!fy) return errorResponse(res, "Invalid Financial Year.");

    const code = normalizeCode(body.typeCode);
    if (await isTypeCodeTaken(companyId, code)) {
      return requiredmessage(res, "Type code already exists.");
    }

    const employeeTypeNo = await generateUniqueEmployeeTypeNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!employeeTypeNo) {
      return errorResponse(
        res,
        "Could not generate a unique Type ID. Please try again.",
      );
    }

    const creator = getCreator(req, companyId);

    const saved: any = await saveModel("employeetype", {
      companyId,
      financialYearId: fy.financialYearId,
      employeeTypeNo,
      typeCode: code,
      typeName: String(body.typeName || "").trim(),
      description: body.description ? String(body.description).trim() : "",
      displayOrder: toNumberOrNull(body.displayOrder),
      status: body.status || "Active",
      createdBy: creator.by,
      createdType: creator.type,
      delete: 0,
    });

    if (!saved?.employeeTypeId) {
      return errorResponse(res, "Failed to save employee type");
    }

    return successResponse(
      res,
      { employeeTypeId: saved.employeeTypeId, employeeTypeNo },
      "Employee type created successfully.",
    );
  } catch (error) {
    console.error("createEmployeeType error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List Employee Types (logged-in company) ----
export const getEmployeeTypeList = async (
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
      "employeetype",
      [],
      { companyId, delete: 0 },
      [
        "employeeTypeId",
        "financialYearId",
        "employeeTypeNo",
        "typeCode",
        "typeName",
        "description",
        "displayOrder",
        "status",
        "createdBy",
        "createdType",
        "updatedBy",
        "created",
        "updated",
      ],
      [["employeeTypeId", "DESC"]],
    );

    const data = rows.map((r) => ({
      id: String(r.employeeTypeId),
      employeeTypeId: r.employeeTypeId,
      financialYearId: r.financialYearId,
      employeeTypeNo: r.employeeTypeNo || "",
      typeCode: r.typeCode,
      typeName: r.typeName,
      description: r.description || "",
      displayOrder: r.displayOrder,
      status: r.status,
      createdBy: r.createdBy || "",
      createdType: r.createdType || "",
      updatedBy: r.updatedBy || "",
      created: r.created,
      updated: r.updated,
    }));

    return successResponse(res, data, "Employee types fetched successfully.");
  } catch (error) {
    console.error("getEmployeeTypeList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update Employee Type (also used for Activate / Deactivate) ----
export const updateEmployeeType = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as EmployeeTypeBody;
    const { employeeTypeId } = body;

    const existing: any[] = await selectWithJoins(
      "employeetype",
      [],
      { employeeTypeId, companyId, delete: 0 },
      ["employeeTypeId"],
    );
    if (!existing.length) {
      return requiredmessage(res, "Employee type not found.");
    }

    const code = normalizeCode(body.typeCode);
    if (await isTypeCodeTaken(companyId, code, employeeTypeId)) {
      return requiredmessage(res, "Type code already exists.");
    }

    const creator = getCreator(req, companyId);

    // employeeTypeNo, financialYearId, createdBy are not changed on update
    await updateModel(
      "employeetype",
      {
        typeCode: code,
        typeName: String(body.typeName || "").trim(),
        description: body.description ? String(body.description).trim() : "",
        displayOrder: toNumberOrNull(body.displayOrder),
        status: body.status || "Active",
        updatedBy: creator.by,
        updated: new Date(),
      },
      { employeeTypeId, companyId },
    );

    return successResponse(res, {}, "Employee type updated successfully.");
  } catch (error) {
    console.error("updateEmployeeType error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete Employee Type (soft delete) ----
export const deleteEmployeeType = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const employeeTypeId =
      req.body?.employeeTypeId ?? (req.query as any)?.employeeTypeId;

    if (!employeeTypeId) {
      return requiredmessage(res, "Employee type id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "employeetype",
      [],
      { employeeTypeId, companyId, delete: 0 },
      ["employeeTypeId"],
    );
    if (!existing.length) {
      return requiredmessage(res, "Employee type not found.");
    }

    await updateModel(
      "employeetype",
      { delete: 1, updated: new Date() },
      { employeeTypeId, companyId },
    );

    return successResponse(res, {}, "Employee type deleted successfully.");
  } catch (error) {
    console.error("deleteEmployeeType error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
