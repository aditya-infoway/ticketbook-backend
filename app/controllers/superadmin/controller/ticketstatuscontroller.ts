import { Request, Response } from "express";

import {
  errorResponse,
  successResponse,
  requiredmessage,
  saveModel,
  updateModel,
  selectWithJoins,
} from "../../../helper/index";
import { generateVoucherNo } from "../../../helper/billNoGenerator";
import { getFinancialYearById } from "../../../helper/financialYear";

// ---- Types ----
type Id = string | number;

interface TicketStatusBody {
  ticketStatusId?: Id;
  financialYearId?: Id;
  statusCode: string;
  statusName: string;
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

const toText = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value).trim();

const getCreator = (req: Request, companyId: Id): Creator => {
  const employeeId = (req as any).employeeId as Id | undefined;

  return {
    by: employeeId ? String(employeeId) : String(companyId),
    type: employeeId ? "Employee" : "Super Admin",
  };
};

// Status Code must be unique inside a company (case-insensitive)
const isCodeTaken = async (
  companyId: Id,
  code: string,
  excludeId?: Id,
): Promise<boolean> => {
  const rows: any[] = await selectWithJoins(
    "ticketstatus",
    [],
    { companyId, delete: 0 },
    ["ticketStatusId", "statusCode"],
  );

  return rows.some(
    (row) =>
      normalizeCode(row.statusCode) === code &&
      String(row.ticketStatusId) !== String(excludeId ?? ""),
  );
};

// Unique Ticket Status No (prefix + running number)
const generateUniqueTicketStatusNo = async (
  companyId: number,
  financialYearId: number,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { billNo } = await generateVoucherNo({
      companyId,
      financialYearId,
      tableName: "ticketstatus",
      idColumn: "ticketStatusId",
      prefixFor: "TICKET_STATUS",
      numberColumn: "ticketStatusNo",
    });

    const existing: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { companyId, financialYearId, ticketStatusNo: billNo, delete: 0 },
      ["ticketStatusId"],
    );

    if (existing.length === 0) return billNo;

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
};

// ---- Next Ticket Status No (drawer preview) ----
export const getNextTicketStatusNo = async (
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

    const ticketStatusNo = await generateUniqueTicketStatusNo(
      Number(companyId),
      fy.financialYearId,
    );

    if (!ticketStatusNo) {
      return errorResponse(
        res,
        "Could not generate a unique Status ID. Please try again.",
      );
    }

    return successResponse(
      res,
      {
        ticketStatusNo,
        fyLabel: fy.fyLabel,
        financialYearId: fy.financialYearId,
      },
      "Status ID generated successfully",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Create Ticket Status ----
export const createTicketStatus = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);
    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as TicketStatusBody;

    // 1. Validate FY
    const fy: any = await getFinancialYearById(
      body.financialYearId as any,
      Number(companyId),
    );
    if (!fy) return errorResponse(res, "Invalid Financial Year.");

    // 2. Check unique code
    const code = normalizeCode(body.statusCode);
    if (await isCodeTaken(companyId, code)) {
      return requiredmessage(res, "Status code already exists.");
    }

    // 3. Generate Status ID with FY
    const ticketStatusNo = await generateUniqueTicketStatusNo(
      Number(companyId),
      fy.financialYearId,
    );
    if (!ticketStatusNo) {
      return errorResponse(
        res,
        "Could not generate a unique Status ID. Please try again.",
      );
    }

    const creator = getCreator(req, companyId);

    const saved: any = await saveModel("ticketstatus", {
      companyId,
      financialYearId: fy.financialYearId, // ← save FY
      ticketStatusNo,
      statusCode: code,
      statusName: toText(body.statusName),
      description: toText(body.description),
      displayOrder: toNumberOrNull(body.displayOrder),
      status: body.status || "Active",
      createdBy: creator.by,
      createdType: creator.type,
      delete: 0,
    });

    if (!saved?.ticketStatusId) {
      return errorResponse(res, "Failed to save ticket status");
    }

    return successResponse(
      res,
      { ticketStatusId: saved.ticketStatusId, ticketStatusNo },
      "Ticket status created successfully.",
    );
  } catch (error) {
    console.error("createTicketStatus error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- List Ticket Statuses ----
export const getTicketStatusList = async (
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
      "ticketstatus",
      [],
      { companyId, delete: 0 },
      [
        "ticketStatusId",
        "ticketStatusNo",
        "statusCode",
        "statusName",
        "description",
        "displayOrder",
        "status",
        "createdBy",
        "createdType",
        "updatedBy",
        "created",
        "updated",
      ],
      [["ticketStatusId", "DESC"]],
    );

    if (!rows.length) {
      return successResponse(res, [], "Ticket statuses fetched successfully.");
    }

    const data = rows.map((r) => ({
      id: String(r.ticketStatusId),
      ticketStatusId: r.ticketStatusId,
      ticketStatusNo: r.ticketStatusNo || "",
      statusCode: r.statusCode,
      statusName: r.statusName,
      description: r.description || "",
      displayOrder: r.displayOrder,
      status: r.status,
      createdBy: r.createdBy || "",
      createdType: r.createdType || "",
      updatedBy: r.updatedBy || "",
      created: r.created,
      updated: r.updated,
    }));

    return successResponse(res, data, "Ticket statuses fetched successfully.");
  } catch (error) {
    console.error("getTicketStatusList error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update Ticket Status (also used for Activate / Deactivate) ----
export const updateTicketStatus = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as TicketStatusBody;
    const ticketStatusId = Number(body.ticketStatusId);

    const existingRows: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { ticketStatusId, companyId, delete: 0 },
      ["ticketStatusId"],
    );
    if (!existingRows.length) {
      return requiredmessage(res, "Ticket status not found.");
    }

    const code = normalizeCode(body.statusCode);
    if (await isCodeTaken(companyId, code, ticketStatusId)) {
      return requiredmessage(res, "Status code already exists.");
    }

    const creator = getCreator(req, companyId);

    // ticketStatusNo & createdBy are not changed on update
    await updateModel(
      "ticketstatus",
      {
        statusCode: code,
        statusName: toText(body.statusName),
        description: toText(body.description),
        displayOrder: toNumberOrNull(body.displayOrder),
        status: body.status || "Active",
        updatedBy: creator.by,
        updated: new Date(),
      },
      { ticketStatusId, companyId },
    );

    return successResponse(res, {}, "Ticket status updated successfully.");
  } catch (error) {
    console.error("updateTicketStatus error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Delete Ticket Status (soft delete) ----
export const deleteTicketStatus = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const ticketStatusId = Number(
      req.body?.ticketStatusId ?? (req.query as any)?.ticketStatusId,
    );

    if (!ticketStatusId || isNaN(ticketStatusId)) {
      return requiredmessage(res, "Ticket status id is required.");
    }

    const existing: any[] = await selectWithJoins(
      "ticketstatus",
      [],
      { ticketStatusId, companyId, delete: 0 },
      ["ticketStatusId"],
    );
    if (!existing.length) {
      return requiredmessage(res, "Ticket status not found.");
    }

    // TODO: once the Ticket module exists, block delete when tickets use this status.

    await updateModel(
      "ticketstatus",
      { delete: 1, updated: new Date() },
      { ticketStatusId, companyId },
    );

    return successResponse(res, {}, "Ticket status deleted successfully.");
  } catch (error) {
    console.error("deleteTicketStatus error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};
