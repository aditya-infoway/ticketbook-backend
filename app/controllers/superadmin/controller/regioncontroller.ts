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

interface RegionBody {
  regionId?: Id;
  financialYearId?: Id;

  regionCode: string;
  regionName: string;

  description?: string | null;

  regionTypeId?: Id;

  country?: string | null;
  state?: string | null;
  city?: string | null;

  status?: string;
  displayOrder?: number | string | null;

  createdBy?: Id | null;
  createdType?: string | null;
}

interface RegionRow {
  regionId: number;
  financialYearId: number;

  regionNo: string | null;
  regionCode: string;
  regionName: string;

  description: string | null;

  regionTypeId: number;

  country: string | null;
  state: string | null;
  city: string | null;

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

// ======================================================
// Get Company ID From Token
// ======================================================

const getCompanyIdFromToken = async (req: Request): Promise<Id | null> => {
  const token =
    (req.headers["x-token"] as string) ||
    (req.headers["X-Token"] as string) ||
    "";

  if (!token) return null;

  const rows: any[] = await selectWithJoins(
    "company",
    [],
    {
      token,
      delete: 0,
    },
    ["companyId"],
  );

  return rows.length ? rows[0].companyId : null;
};

// ======================================================
// Helpers
// ======================================================

const normalizeCode = (value: unknown): string =>
  String(value || "")
    .trim()
    .toUpperCase();

const toNumberOrNull = (value: unknown): number | null =>
  value === undefined || value === null || value === "" ? null : Number(value);

// ======================================================
// Creator
// ======================================================

const getCreator = (req: Request, body: RegionBody, companyId: Id): Creator => {
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

// ======================================================
// Region Code Unique Check
// ======================================================

const isCodeTaken = async (
  companyId: Id,
  code: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "region",
    [],
    {
      companyId,
      delete: 0,
    },
    ["regionId", "regionCode"],
  );

  return rows.some(
    (row) =>
      normalizeCode(row.regionCode) === code &&
      String(row.regionId) !== String(excludeId ?? ""),
  );
};

// ======================================================
// Validate Region Type
// ======================================================

const validateRegionType = async (
  companyId: Id,
  regionTypeId: unknown,
): Promise<string | null> => {
  const types: any[] = await selectWithJoins(
    "regiontype",
    [],
    {
      regionTypeId,
      companyId,
      delete: 0,
    },
    ["regionTypeId"],
  );

  if (!types.length) {
    return "Selected region type was not found.";
  }

  return null;
};

// ======================================================
// Generate Unique Region No
// ======================================================

const generateUniqueRegionNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,

      tableName: "region",

      idColumn: "regionId",

      prefixFor: "REGION",
    });

    const existing: any[] = await selectWithJoins(
      "region",
      [],
      {
        companyId,
        financialYearId,
        regionNo: billNo,
        delete: 0,
      },
      ["regionId"],
    );

    if (existing.length === 0) {
      return billNo;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
};

// ======================================================
// Next Region No
// ======================================================

export const getNextRegionNo = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const { financialYearId } = req.query as {
      financialYearId?: string;
    };

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

    if (!fy) {
      return errorResponse(res, "Invalid Financial Year.");
    }

    const regionNo = await generateUniqueRegionNo(
      Number(companyId),
      fy.financialYearId,
    );

    if (!regionNo) {
      return errorResponse(
        res,
        "Could not generate a unique Region ID. Please try again.",
      );
    }

    return successResponse(
      res,
      {
        regionNo,
        fyLabel: fy.fyLabel,
        financialYearId: fy.financialYearId,
      },
      "Region ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ======================================================
// Create Region
// ======================================================

export const createRegion = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as RegionBody;

    // ------------------------------------------
    // Financial Year
    // ------------------------------------------

    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );

    if (!fy) {
      return errorResponse(res, "Invalid Financial Year.");
    }

    // ------------------------------------------
    // Region Code
    // ------------------------------------------

    const code = normalizeCode(body.regionCode);

    if (await isCodeTaken(companyId, code)) {
      return requiredmessage(res, "Region code already exists.");
    }

    // ------------------------------------------
    // Region Type
    // ------------------------------------------

    const typeError = await validateRegionType(companyId, body.regionTypeId);

    if (typeError) {
      return errorResponse(res, typeError);
    }

    // ------------------------------------------
    // Generate Region No
    // ------------------------------------------

    const regionNo = await generateUniqueRegionNo(
      Number(companyId),
      fy.financialYearId,
    );

    if (!regionNo) {
      return errorResponse(
        res,
        "Could not generate a unique Region ID. Please try again.",
      );
    }

    // ------------------------------------------
    // Creator
    // ------------------------------------------

    const creator = getCreator(req, body, companyId);

    // ------------------------------------------
    // Save
    // ------------------------------------------

    const saved: any = await saveModel("region", {
      companyId,

      financialYearId: fy.financialYearId,

      regionNo,

      regionCode: code,

      regionName: String(body.regionName || "").trim(),

      description: body.description ? String(body.description).trim() : "",

      regionTypeId: Number(body.regionTypeId),

      country: body.country ? String(body.country).trim() : "",

      state: body.state ? String(body.state).trim() : "",

      city: body.city ? String(body.city).trim() : "",

      status: body.status || "Active",

      displayOrder: toNumberOrNull(body.displayOrder),

      createdBy: creator.by,

      createdtype: creator.type,

      delete: 0,
    });

    if (!saved?.regionId) {
      return errorResponse(res, "Failed to save region");
    }

    return successResponse(
      res,
      {
        regionId: saved.regionId,

        regionNo,
      },
      "Region created successfully.",
    );
  } catch (error) {
    console.error("createRegion error:", error);

    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ======================================================
// Region List
// ======================================================

export const getRegionList = async (
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

    // ------------------------------------------
    // Get Regions
    // ------------------------------------------

    const rows = (await selectWithJoins(
      "region",
      [],
      { companyId, delete: 0 },
      [
        "regionId",
        "financialYearId",
        "regionNo",
        "regionCode",
        "regionName",
        "description",
        "regionTypeId",
        "country",
        "state",
        "city",
        "status",
        "displayOrder",
        "createdBy",
        "createdtype",
        "updatedBy",
        "created",
        "updated",
      ],
      [["regionId", "DESC"]],
    )) as unknown as RegionRow[];

    if (!rows.length) {
      return successResponse(res, [], "Regions fetched successfully.");
    }

    // ------------------------------------------
    // Region Type Names
    // ------------------------------------------

    const typeRows: any[] = await selectWithJoins(
      "regiontype",
      [],
      {
        companyId,
        delete: 0,
      },
      ["regionTypeId", "typeName", "typeCode"],
    );

    const typeMap: Record<
      string,
      {
        typeName: string;
        typeCode: string;
      }
    > = {};

    typeRows.forEach((t) => {
      typeMap[String(t.regionTypeId)] = {
        typeName: t.typeName || "",

        typeCode: t.typeCode || "",
      };
    });

    // ------------------------------------------
    // Employee IDs
    // ------------------------------------------

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

    // const empMap: Record<string, string> = {};

    // if (empIds.length) {
    //   try {
    //     const emps: any[] = await selectWithJoins(
    //       "employee",
    //       [],
    //       {
    //         employeeId: empIds,
    //       },
    //       ["employeeId", "employeeName"],
    //     );

    //     emps.forEach((e) => {
    //       empMap[String(e.employeeId)] = e.employeeName || "";
    //     });
    //   } catch (err) {
    //     console.error("Error fetching employees:", err);
    //   }
    // }

    // ------------------------------------------
    // Company Names
    // ------------------------------------------

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
          {
            companyId: compIds,
            delete: 0,
          },
          ["companyId", "companyName"],
        );

        comps.forEach((c) => {
          companyMap[String(c.companyId)] = c.companyName || "";
        });
      } catch (err) {
        console.error("Error fetching companies:", err);
      }
    }

    // ------------------------------------------
    // Who Created / Updated
    // ------------------------------------------
const who = (value: string | null): string => {
  if (!value) return "";
  return companyMap[String(value)] || String(value);
};
    // ------------------------------------------
    // Final Data
    // ------------------------------------------

    const data = rows.map((r) => {
      const type = typeMap[String(r.regionTypeId)];

      return {
        id: String(r.regionId),

        regionId: r.regionId,

        financialYearId: r.financialYearId,

        regionNo: r.regionNo || "",

        regionCode: r.regionCode,

        regionName: r.regionName,

        description: r.description || "",

        regionTypeId: r.regionTypeId,

        regionTypeName: type?.typeName || "",

        typeCode: type?.typeCode || "",

        country: r.country || "",

        state: r.state || "",

        city: r.city || "",

        status: r.status,

        displayOrder: r.displayOrder,

       createdBy: who(r.createdBy),
updatedBy: who(r.updatedBy),

        created: r.created,

        updated: r.updated,
      };
    });

    return successResponse(res, data, "Regions fetched successfully.");
  } catch (error) {
    console.error("getRegionList error:", error);

    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ======================================================
// Update Region
// ======================================================

export const updateRegion = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as RegionBody;

    const { regionId } = body;

    // ------------------------------------------
    // Existing Region
    // ------------------------------------------

    const existing: any[] = await selectWithJoins(
      "region",
      [],
      {
        regionId,
        companyId,
        delete: 0,
      },
      ["regionId"],
    );

    if (!existing.length) {
      return requiredmessage(res, "Region not found.");
    }

    // ------------------------------------------
    // Code Unique
    // ------------------------------------------

    const code = normalizeCode(body.regionCode);

    if (await isCodeTaken(companyId, code, regionId)) {
      return requiredmessage(res, "Region code already exists.");
    }

    // ------------------------------------------
    // Region Type
    // ------------------------------------------

    const typeError = await validateRegionType(companyId, body.regionTypeId);

    if (typeError) {
      return errorResponse(res, typeError);
    }

    // ------------------------------------------
    // Creator / Updater
    // ------------------------------------------

    const creator = getCreator(req, body, companyId);

    // ------------------------------------------
    // Update
    // ------------------------------------------

    await updateModel(
      "region",
      {
        regionCode: code,

        regionName: String(body.regionName || "").trim(),

        description: body.description ? String(body.description).trim() : "",

        regionTypeId: Number(body.regionTypeId),

        country: body.country ? String(body.country).trim() : "",

        state: body.state ? String(body.state).trim() : "",

        city: body.city ? String(body.city).trim() : "",

        status: body.status || "Active",

        displayOrder: toNumberOrNull(body.displayOrder),

        updatedBy: creator.by,

        updated: new Date(),
      },

      {
        regionId,
        companyId,
      },
    );

    return successResponse(res, {}, "Region updated successfully.");
  } catch (error) {
    console.error("updateRegion error:", error);

    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ======================================================
// Delete Region - Soft Delete
// ======================================================

export const deleteRegion = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const regionId = req.body?.regionId ?? (req.query as any)?.regionId;

    if (!regionId) {
      return requiredmessage(res, "Region id is required.");
    }

    // ------------------------------------------
    // Existing Region
    // ------------------------------------------

    const existing: any[] = await selectWithJoins(
      "region",
      [],
      {
        regionId,
        companyId,
        delete: 0,
      },
      ["regionId"],
    );

    if (!existing.length) {
      return requiredmessage(res, "Region not found.");
    }

    // ------------------------------------------
    // Soft Delete
    // ------------------------------------------

    await updateModel(
      "region",
      {
        delete: 1,
        updated: new Date(),
      },
      {
        regionId,
        companyId,
      },
    );

    return successResponse(res, {}, "Region deleted successfully.");
  } catch (error) {
    console.error("deleteRegion error:", error);

    return errorResponse(res, "Something Went Wrong", error);
  }
};
