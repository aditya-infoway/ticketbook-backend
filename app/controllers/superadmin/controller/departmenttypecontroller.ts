import { Request, Response } from "express";

import {
  errorResponse,
  successResponse,
  requiredmessage,
  saveModel,
  updateModel,
  selectWithJoins,
  selectWithJoinsV2,
} from "../../../helper/index";

// ---- Types ----
interface DepartmentTypeBody {
  departmentTypeId?: string | number;
  typeCode: string;
  typeName: string;
  description?: string | null;
  displayOrder?: number | string | null;
  status?: string;
}

// ---- Get company from token ----
const getCompanyIdFromToken = async (
  req: Request,
): Promise<number | string | null> => {
  const token =
    (req.headers["x-token"] as string) ||
    (req.headers["X-Token"] as string) ||
    "";

  if (!token) {
    return null;
  }

  const companyRows: any[] = await selectWithJoins(
    "company",
    [],
    { token, delete: 0 },
    ["companyId"],
  );

  if (companyRows.length === 0) {
    return null;
  }

  return companyRows[0].companyId;
};

// ---- Helpers ----
const normalizeCode = (value: unknown): string =>
  String(value || "")
    .trim()
    .toUpperCase();

const toDisplayOrder = (value: unknown): number | null =>
  value === undefined || value === null || value === ""
    ? null
    : Number(value);

// Type Code must be unique inside a company (case-insensitive).
const isTypeCodeTaken = async (
  companyId: number | string,
  typeCode: string,
  excludeId?: string | number,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "departmenttype",
    [],
    { companyId, delete: 0 },
    ["departmentTypeId", "typeCode"],
  );

  return rows.some(
    (row) =>
      normalizeCode(row.typeCode) === typeCode &&
      String(row.departmentTypeId) !== String(excludeId ?? ""),
  );
};

// ---- Create Department Type ----
export const createDepartmentType = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const { typeCode, typeName, description, displayOrder, status } =
      req.body as DepartmentTypeBody;

    const code = normalizeCode(typeCode);

    if (await isTypeCodeTaken(companyId, code)) {
      return requiredmessage(res, "Type code already exists.");
    }

    const payload = {
      companyId,
      typeCode: code,
      typeName: String(typeName || "").trim(),
      description: description ? String(description).trim() : "",
      displayOrder: toDisplayOrder(displayOrder),
      status: status || "Active",
      delete: 0,
    };

    const saved: any = await saveModel("departmenttype", payload);
    const departmentTypeId = saved?.departmentTypeId;

    if (!departmentTypeId) {
      return errorResponse(res, "Failed to save department type");
    }

    return successResponse(
      res,
      { departmentTypeId },
      "Department type created successfully.",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List Department Types (logged-in company) ----
export const getDepartmentTypeList = async (
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

    const tableName = "departmenttype";
    const whereClause = {
      '"departmenttype"."companyId"': companyId,
      '"departmenttype"."delete"': 0,
    };
    const attributes = [
      '"departmenttype"."departmentTypeId"',
      '"departmenttype"."typeCode"',
      '"departmenttype"."typeName"',
      '"departmenttype"."description"',
      '"departmenttype"."displayOrder"',
      '"departmenttype"."status"',
      '"departmenttype"."created"',
    ];
    const order: [string, string][] = [
      ['"departmenttype"."created"', "DESC"],
    ];

    const rows = await selectWithJoinsV2(
      tableName,
      [],
      whereClause,
      attributes,
      order,
      null,
      0,
    );

    return successResponse(
      res,
      rows,
      "Department types fetched successfully.",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update Department Type (also used for Activate / Deactivate) ----
export const updateDepartmentType = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const {
      departmentTypeId,
      typeCode,
      typeName,
      description,
      displayOrder,
      status,
    } = req.body as DepartmentTypeBody;

    const existing: any[] = await selectWithJoins(
      "departmenttype",
      [],
      { departmentTypeId, companyId, delete: 0 },
      ["departmentTypeId"],
    );

    if (existing.length === 0) {
      return requiredmessage(res, "Department type not found.");
    }

    const code = normalizeCode(typeCode);

    if (await isTypeCodeTaken(companyId, code, departmentTypeId)) {
      return requiredmessage(res, "Type code already exists.");
    }

    const updatePayload: Record<string, any> = {
      typeCode: code,
      typeName: String(typeName || "").trim(),
      description: description ? String(description).trim() : "",
      displayOrder: toDisplayOrder(displayOrder),
      status: status || "Active",
      updated: new Date(),
    };

    await updateModel("departmenttype", updatePayload, {
      departmentTypeId,
      companyId,
    });

    return successResponse(res, {}, "Department type updated successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};
// ---- Delete Department Type (soft delete) ----
export const deleteDepartmentType = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    // frontend Delete(...) body ya query, dono me se jo bheje wo chalega
    const departmentTypeId =
      req.body?.departmentTypeId ?? req.query?.departmentTypeId;

    if (!departmentTypeId) {
      return requiredmessage(res, "Department type id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "departmenttype",
      [],
      { departmentTypeId, companyId, delete: 0 },
      ["departmentTypeId"],
    );

    if (existing.length === 0) {
      return requiredmessage(res, "Department type not found.");
    }

    await updateModel(
      "departmenttype",
      { delete: 1, updated: new Date() },
      { departmentTypeId, companyId },
    );

    return successResponse(res, {}, "Department type deleted successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};