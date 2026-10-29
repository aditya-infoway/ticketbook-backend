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

interface TicketCategoryBody {
  ticketCategoryId?: Id;
  financialYearId?: Id;
  categoryCode: string;
  categoryName: string;
  description?: string | null;
  departmentId: Id;
  defaultResolverTeamId?: Id | null;
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

const toText = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value).trim();

const getCreator = (req: Request, companyId: Id): Creator => {
  const employeeId = (req as any).employeeId as Id | undefined;

  return {
    by: employeeId ? String(employeeId) : String(companyId),
    type: employeeId ? "Employee" : "Super Admin",
  };
};

// Category Code must be unique inside a company (case-insensitive)
const isCodeTaken = async (
  companyId: Id,
  code: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "ticketcategory",
    [],
    { companyId, delete: 0 },
    ["ticketCategoryId", "categoryCode"],
  );

  return rows.some(
    (row) =>
      normalizeCode(row.categoryCode) === code &&
      String(row.ticketCategoryId) !== String(excludeId ?? ""),
  );
};

// Department + default resolver team must exist, and the team must belong to
// the department. Inactive ones are only rejected when newly picked.
const validateLinks = async (
  companyId: Id,
  departmentId: number,
  teamId: number | null,
  existing?: { departmentId?: number | null; teamId?: number | null },
): Promise<string | null> => {
  const deptRows: any[] = await selectWithJoins(
    "department",
    [],
    { departmentId, companyId, delete: 0 },
    ["departmentId", "status"],
  );
  if (!deptRows.length) return "Selected department was not found.";
  if (
    Number(existing?.departmentId) !== departmentId &&
    deptRows[0].status !== "Active"
  ) {
    return "Selected department is inactive.";
  }

  if (teamId) {
    const teamRows: any[] = await selectWithJoins(
      "resolverteam",
      [],
      { resolverTeamId: teamId, companyId, delete: 0 },
      ["resolverTeamId", "departmentId", "status"],
    );
    if (!teamRows.length) return "Selected resolver team was not found.";

    if (Number(teamRows[0].departmentId) !== departmentId) {
      return "Default resolver team must belong to the selected department.";
    }
    if (
      Number(existing?.teamId) !== teamId &&
      teamRows[0].status !== "Active"
    ) {
      return "Selected resolver team is inactive.";
    }
  }

  return null;
};

// Unique Ticket Category No (prefix + FY + running number), retry on collision
const generateUniqueTicketCategoryNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "ticketcategory",
      idColumn: "ticketCategoryId",
      prefixFor: "TICKET_CATEGORY",
      numberColumn: "ticketCategoryNo",
    });

    const existing: any[] = await selectWithJoins(
      "ticketcategory",
      [],
      { companyId, financialYearId, ticketCategoryNo: billNo, delete: 0 },
      ["ticketCategoryId"],
    );

    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
};

// ---- Next Ticket Category No (drawer preview) ----
export const getNextTicketCategoryNo = async (
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

    const ticketCategoryNo = await generateUniqueTicketCategoryNo(
      Number(companyId),
      fy.financialYearId,
    );

    if (!ticketCategoryNo) {
      return errorResponse(
        res,
        "Could not generate a unique Category ID. Please try again.",
      );
    }

    return successResponse(
      res,
      {
        ticketCategoryNo,
        fyLabel: fy.fyLabel,
        financialYearId: fy.financialYearId,
      },
      "Category ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Create Ticket Category ----
export const createTicketCategory = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as TicketCategoryBody;

    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );
    if (!fy) return errorResponse(res, "Invalid Financial Year.");

    const code = normalizeCode(body.categoryCode);
    if (await isCodeTaken(companyId, code)) {
      return requiredmessage(res, "Category code already exists.");
    }

    const departmentId = Number(body.departmentId);
    const teamId = toNumberOrNull(body.defaultResolverTeamId);

    const linkError = await validateLinks(companyId, departmentId, teamId);
    if (linkError) return errorResponse(res, linkError);

    const ticketCategoryNo = await generateUniqueTicketCategoryNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!ticketCategoryNo) {
      return errorResponse(
        res,
        "Could not generate a unique Category ID. Please try again.",
      );
    }

    const creator = getCreator(req, companyId);

    const saved: any = await saveModel("ticketcategory", {
      companyId,
      financialYearId: fy.financialYearId,
      ticketCategoryNo,
      categoryCode: code,
      categoryName: toText(body.categoryName),
      description: toText(body.description),
      departmentId,
      defaultResolverTeamId: teamId,
      displayOrder: toNumberOrNull(body.displayOrder),
      status: body.status || "Active",
      createdBy: creator.by,
      createdType: creator.type,
      delete: 0,
    });

    if (!saved?.ticketCategoryId) {
      return errorResponse(res, "Failed to save ticket category");
    }

    return successResponse(
      res,
      { ticketCategoryId: saved.ticketCategoryId, ticketCategoryNo },
      "Ticket category created successfully.",
    );
  } catch (error) {
    console.error("createTicketCategory error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List Ticket Categories ----
export const getTicketCategoryList = async (
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
      "ticketcategory",
      [],
      { companyId, delete: 0 },
      [
        "ticketCategoryId",
        "financialYearId",
        "ticketCategoryNo",
        "categoryCode",
        "categoryName",
        "description",
        "departmentId",
        "defaultResolverTeamId",
        "displayOrder",
        "status",
        "createdBy",
        "createdType",
        "updatedBy",
        "created",
        "updated",
      ],
      [["ticketCategoryId", "DESC"]],
    );

    if (!rows.length) {
      return successResponse(
        res,
        [],
        "Ticket categories fetched successfully.",
      );
    }

    // Name lookups
    const deptRows: any[] = await selectWithJoins(
      "department",
      [],
      { companyId, delete: 0 },
      ["departmentId", "departmentName"],
    );
    const deptMap: Record<string, string> = {};
    deptRows.forEach((d) => {
      deptMap[String(d.departmentId)] = d.departmentName;
    });

    const teamRows: any[] = await selectWithJoins(
      "resolverteam",
      [],
      { companyId, delete: 0 },
      ["resolverTeamId", "teamName"],
    );
    const teamMap: Record<string, string> = {};
    teamRows.forEach((t) => {
      teamMap[String(t.resolverTeamId)] = t.teamName;
    });

    const data = rows.map((r) => ({
      id: String(r.ticketCategoryId),
      ticketCategoryId: r.ticketCategoryId,
      financialYearId: r.financialYearId,
      ticketCategoryNo: r.ticketCategoryNo || "",
      categoryCode: r.categoryCode,
      categoryName: r.categoryName,
      description: r.description || "",
      departmentId: r.departmentId,
      departmentName: deptMap[String(r.departmentId)] || "",
      defaultResolverTeamId: r.defaultResolverTeamId,
      defaultResolverTeamName: r.defaultResolverTeamId
        ? teamMap[String(r.defaultResolverTeamId)] || ""
        : "",
      displayOrder: r.displayOrder,
      status: r.status,
      createdBy: r.createdBy || "",
      createdType: r.createdType || "",
      updatedBy: r.updatedBy || "",
      created: r.created,
      updated: r.updated,
    }));

    return successResponse(
      res,
      data,
      "Ticket categories fetched successfully.",
    );
  } catch (error) {
    console.error("getTicketCategoryList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update Ticket Category (also used for Activate / Deactivate) ----
export const updateTicketCategory = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as TicketCategoryBody;
    const ticketCategoryId = Number(body.ticketCategoryId);

    const existingRows: any[] = await selectWithJoins(
      "ticketcategory",
      [],
      { ticketCategoryId, companyId, delete: 0 },
      ["ticketCategoryId", "departmentId", "defaultResolverTeamId"],
    );
    if (!existingRows.length) {
      return requiredmessage(res, "Ticket category not found.");
    }

    const code = normalizeCode(body.categoryCode);
    if (await isCodeTaken(companyId, code, ticketCategoryId)) {
      return requiredmessage(res, "Category code already exists.");
    }

    const departmentId = Number(body.departmentId);
    const teamId = toNumberOrNull(body.defaultResolverTeamId);

    const linkError = await validateLinks(companyId, departmentId, teamId, {
      departmentId: existingRows[0].departmentId,
      teamId: existingRows[0].defaultResolverTeamId,
    });
    if (linkError) return errorResponse(res, linkError);

    const creator = getCreator(req, companyId);

    // ticketCategoryNo, financialYearId, createdBy are not changed on update
    await updateModel(
      "ticketcategory",
      {
        categoryCode: code,
        categoryName: toText(body.categoryName),
        description: toText(body.description),
        departmentId,
        defaultResolverTeamId: teamId,
        displayOrder: toNumberOrNull(body.displayOrder),
        status: body.status || "Active",
        updatedBy: creator.by,
        updated: new Date(),
      },
      { ticketCategoryId, companyId },
    );

    return successResponse(res, {}, "Ticket category updated successfully.");
  } catch (error) {
    console.error("updateTicketCategory error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete Ticket Category (soft delete) ----
export const deleteTicketCategory = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const ticketCategoryId = Number(
      req.body?.ticketCategoryId ?? (req.query as any)?.ticketCategoryId,
    );

    if (!ticketCategoryId || isNaN(ticketCategoryId)) {
      return requiredmessage(res, "Ticket category id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "ticketcategory",
      [],
      { ticketCategoryId, companyId, delete: 0 },
      ["ticketCategoryId"],
    );
    if (!existing.length) {
      return requiredmessage(res, "Ticket category not found.");
    }

    // TODO: once the Ticket module exists, block delete when tickets use this category.

    await updateModel(
      "ticketcategory",
      { delete: 1, updated: new Date() },
      { ticketCategoryId, companyId },
    );

    return successResponse(res, {}, "Ticket category deleted successfully.");
  } catch (error) {
    console.error("deleteTicketCategory error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
