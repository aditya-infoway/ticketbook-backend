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
interface RegionTypeBody {
  regionTypeId?: string | number;
  typeCode: string;
  typeName: string;
  description?: string | null;
  displayOrder?: number | string | null;
  status?: string;
}

interface AuthContext {
  companyId: number | string;
  createdBy: number | string;
  createdType: string;
}

// ---- Get company / audit info from token ----
// createdBy   -> id of the logged-in record (company row here)
// createdType -> what kind of login created it
// If a user/employee token table exists later, resolve it here and
// return its id + type instead (e.g. "employee", "admin").
const getAuthFromToken = async (req: Request): Promise<AuthContext | null> => {
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

  return {
    companyId: companyRows[0].companyId,
    createdBy: companyRows[0].companyId,
    createdType: "company",
  };
};

// ---- Helpers ----
const normalizeCode = (value: unknown): string =>
  String(value || "")
    .trim()
    .toUpperCase();

const toDisplayOrder = (value: unknown): number | null =>
  value === undefined || value === null || value === "" ? null : Number(value);

// Type Code must be unique inside a company (case-insensitive).
const isTypeCodeTaken = async (
  companyId: number | string,
  typeCode: string,
  excludeId?: string | number,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "regiontype",
    [],
    { companyId, delete: 0 },
    ["regionTypeId", "typeCode"],
  );

  return rows.some(
    (row) =>
      normalizeCode(row.typeCode) === typeCode &&
      String(row.regionTypeId) !== String(excludeId ?? ""),
  );
};

// ---- Create Region Type ----
export const createRegionType = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const auth = await getAuthFromToken(req);

    if (!auth) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const { typeCode, typeName, description, displayOrder, status } =
      req.body as RegionTypeBody;

    const code = normalizeCode(typeCode);

    if (await isTypeCodeTaken(auth.companyId, code)) {
      return requiredmessage(res, "Type code already exists.");
    }

    const payload = {
      companyId: auth.companyId,
      typeCode: code,
      typeName: String(typeName || "").trim(),
      description: description ? String(description).trim() : "",
      displayOrder: toDisplayOrder(displayOrder),
      status: status || "Active",
      createdBy: auth.createdBy,
      createdType: auth.createdType,
      delete: 0,
    };

    const saved: any = await saveModel("regiontype", payload);
    const regionTypeId = saved?.regionTypeId;

    if (!regionTypeId) {
      return errorResponse(res, "Failed to save region type");
    }

    return successResponse(
      res,
      { regionTypeId },
      "Region type created successfully.",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List Region Types (logged-in company) ----
export const getRegionTypeList = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const auth = await getAuthFromToken(req);

    if (!auth) {
      return requiredmessage(
        res,
        "Invalid or expired session. Please login again.",
      );
    }

    const tableName = "regiontype";
    const whereClause = {
      '"regiontype"."companyId"': auth.companyId,
      '"regiontype"."delete"': 0,
    };
    const attributes = [
      '"regiontype"."regionTypeId"',
      '"regiontype"."typeCode"',
      '"regiontype"."typeName"',
      '"regiontype"."description"',
      '"regiontype"."displayOrder"',
      '"regiontype"."status"',
      '"regiontype"."createdBy"',
      '"regiontype"."createdType"',
      '"regiontype"."created"',
    ];
    const order: [string, string][] = [['"regiontype"."created"', "DESC"]];

    const rows = await selectWithJoinsV2(
      tableName,
      [],
      whereClause,
      attributes,
      order,
      null,
      0,
    );

    return successResponse(res, rows, "Region types fetched successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update Region Type (also used for Activate / Deactivate) ----
export const updateRegionType = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const auth = await getAuthFromToken(req);

    if (!auth) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const {
      regionTypeId,
      typeCode,
      typeName,
      description,
      displayOrder,
      status,
    } = req.body as RegionTypeBody;

    const existing: any[] = await selectWithJoins(
      "regiontype",
      [],
      { regionTypeId, companyId: auth.companyId, delete: 0 },
      ["regionTypeId"],
    );

    if (existing.length === 0) {
      return requiredmessage(res, "Region type not found.");
    }

    const code = normalizeCode(typeCode);

    if (await isTypeCodeTaken(auth.companyId, code, regionTypeId)) {
      return requiredmessage(res, "Type code already exists.");
    }

    // createdBy / createdType are intentionally NOT touched on update
    const updatePayload: Record<string, any> = {
      typeCode: code,
      typeName: String(typeName || "").trim(),
      description: description ? String(description).trim() : "",
      displayOrder: toDisplayOrder(displayOrder),
      status: status || "Active",
      updated: new Date(),
    };

    await updateModel("regiontype", updatePayload, {
      regionTypeId,
      companyId: auth.companyId,
    });

    return successResponse(res, {}, "Region type updated successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete Region Type (soft delete) ----
export const deleteRegionType = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const auth = await getAuthFromToken(req);

    if (!auth) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const regionTypeId = req.body?.regionTypeId ?? req.query?.regionTypeId;

    if (!regionTypeId) {
      return requiredmessage(res, "Region type id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "regiontype",
      [],
      { regionTypeId, companyId: auth.companyId, delete: 0 },
      ["regionTypeId"],
    );

    if (existing.length === 0) {
      return requiredmessage(res, "Region type not found.");
    }

    await updateModel(
      "regiontype",
      { delete: 1, updated: new Date() },
      { regionTypeId, companyId: auth.companyId },
    );

    return successResponse(res, {}, "Region type deleted successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};
