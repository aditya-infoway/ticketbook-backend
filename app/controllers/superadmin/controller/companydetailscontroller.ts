import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import "multer";
import {
  errorResponse,
  successResponse,
  requiredmessage,
  saveModel,
  updateModel,
  selectWithJoins,
  selectWithJoinsV2,
  getBlobTempPublicUrl,
} from "../../../helper/index";

// ---- Types ----
interface FinancialYearBody {
  startDate: string;
  endDate: string;
}

interface CompanyDetailsBody {
  companyDetailsId?: string | number;
  companyName: string;
  companyCode: string;
  natureOfBusiness: string;
  taxSystem: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  pinCode: string;
  country: string;
  state: string;
  stateCode: string;
  district: string;
  mobile: string;
  phone?: string;
  email: string;
  website?: string;
  dateFormat: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  gstNo?: string;
  vatNo?: string;
  panNo?: string;
  tanNo?: string;
  dlNo1?: string;
  dlNo2?: string;
  dealsIn?: string;
  bankHolderName?: string;
  bankAccountNo?: string;
  branchName?: string;
  ifscCode?: string;
  financialYear?: FinancialYearBody;
}

type UploadedFiles = { [fieldname: string]: Express.Multer.File[] };

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

// ---- Create Company Details + Financial Year ----
export const createCompanyDetails = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const {
      companyName,
      companyCode,
      natureOfBusiness,
      taxSystem,
      addressLine1,
      addressLine2,
      city,
      pinCode,
      country,
      state,
      stateCode,
      district,
      mobile,
      phone,
      email,
      website,
      dateFormat,
      latitude,
      longitude,
      gstNo,
      vatNo,
      panNo,
      tanNo,
      dlNo1,
      dlNo2,
      dealsIn,
      bankHolderName,
      bankAccountNo,
      branchName,
      ifscCode,
      financialYear,
    } = req.body as CompanyDetailsBody;

    // ---- 1. Insert into companydetails table ----
    const companyDetailsPayload = {
      companyId,
      companyName,
      companyCode: String(companyCode || "")
        .trim()
        .toUpperCase(),
      natureOfBusiness,
      taxSystem,
      addressLine1,
      addressLine2: addressLine2 || "",
      city,
      pinCode,
      country,
      state,
      stateCode,
      district,
      mobile,
      phone: phone || "",
      email,
      website: website || "",
      dateFormat,
      latitude: latitude || null,
      longitude: longitude || null,
      gstNo: gstNo || "",
      vatNo: vatNo || "",
      panNo: panNo || "",
      tanNo: tanNo || "",
      dlNo1: dlNo1 || "",
      dlNo2: dlNo2 || "",
      dealsIn: dealsIn || "",
      bankHolderName: bankHolderName || "",
      bankAccountNo: bankAccountNo || "",
      branchName: branchName || "",
      ifscCode: ifscCode || "",
      delete: 0,
    };

    const companyDetailsData: any = await saveModel(
      "companydetails",
      companyDetailsPayload,
    );
    const companyDetailsId = companyDetailsData?.companyDetailsId;

    if (!companyDetailsId) {
      return errorResponse(res, "Failed to save company details");
    }

    // ---- 2. Insert into financialyear table ----
    const financialYearPayload = {
      companyDetailsId,
      companyId,
      startDate: financialYear?.startDate,
      endDate: financialYear?.endDate,
      delete: 0,
    };

    const financialYearData: any = await saveModel(
      "financialyear",
      financialYearPayload,
    );
    const financialYearId = financialYearData?.financialYearId;

    if (!financialYearId) {
      return errorResponse(res, "Failed to save financial year details");
    }

    return successResponse(
      res,
      { companyDetailsId, financialYearId },
      "Company details saved successfully.",
    );
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Get all Financial Years for logged-in company (with companyName) ----
export const getFinancialYears = async (
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

    const tableName = "financialyear";
    const joinTables = [
      {
        table: "companydetails",
        alias: "cd",
        onClause: {
          '"cd"."companyDetailsId"': {
            "=": '"financialyear"."companyDetailsId"',
          },
        },
      },
    ];
    const whereClause = {
      '"financialyear"."companyId"': companyId,
      '"financialyear"."delete"': 0,
      '"cd"."delete"': 0,
    };
    const attributes = [
      '"financialyear"."financialYearId"',
      '"financialyear"."companyDetailsId"',
      '"financialyear"."companyId"',
      '"financialyear"."startDate"',
      '"financialyear"."endDate"',
      '"cd"."companyName"',
    ];
    const order: [string, string][] = [['"financialyear"."startDate"', "DESC"]];

    const rows = await selectWithJoinsV2(
      tableName,
      joinTables,
      whereClause,
      attributes,
      order,
      null,
      0,
    );

    return successResponse(res, rows, "Financial years fetched successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Get single Company Details by companyDetailsId ----
export const getCompanyDetails = async (
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

    const companyDetailsId = req.query.companyDetailsId as string | undefined;

    if (!companyDetailsId) {
      return requiredmessage(res, "companyDetailsId is required");
    }

    const rows: any[] = await selectWithJoins(
      "companydetails",
      [],
      {
        companyDetailsId,
        companyId,
        delete: 0,
      },
      [
        "companyDetailsId",
        "companyId",
        "companyName",
        "companyCode",
        "natureOfBusiness",
        "taxSystem",
        "addressLine1",
        "addressLine2",
        "city",
        "pinCode",
        "country",
        "state",
        "stateCode",
        "district",
        "mobile",
        "phone",
        "email",
        "website",
        "dateFormat",
        "latitude",
        "longitude",
        "gstNo",
        "vatNo",
        "panNo",
        "tanNo",
        "dlNo1",
        "dlNo2",
        "dealsIn",
        "bankHolderName",
        "bankAccountNo",
        "branchName",
        "ifscCode",
        "logo",
        "icon",
      ],
    );

    if (rows.length === 0) {
      return requiredmessage(res, "Company details not found.");
    }

    const data = rows[0];
    data.logo = getBlobTempPublicUrl(data.logo); // full URL bana do
    data.icon = getBlobTempPublicUrl(data.icon);

    return successResponse(res, data, "Company details fetched successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update Company Details (with optional logo/icon upload) ----
export const updateCompanyDetails = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const {
      companyDetailsId,
      companyName,
      companyCode,
      natureOfBusiness,
      taxSystem,
      addressLine1,
      addressLine2,
      city,
      pinCode,
      country,
      state,
      stateCode,
      district,
      mobile,
      phone,
      email,
      website,
      dateFormat,
      latitude,
      longitude,
      gstNo,
      vatNo,
      panNo,
      tanNo,
      dlNo1,
      dlNo2,
      dealsIn,
      bankHolderName,
      bankAccountNo,
      branchName,
      ifscCode,
    } = req.body as CompanyDetailsBody;

    const existing: any[] = await selectWithJoins(
      "companydetails",
      [],
      { companyDetailsId, companyId, delete: 0 },
      ["companyDetailsId", "logo", "icon"],
    );

    if (existing.length === 0) {
      return requiredmessage(res, "Company details not found.");
    }

    const updatePayload: Record<string, any> = {
      companyName,
      companyCode: String(companyCode || "")
        .trim()
        .toUpperCase(),
      natureOfBusiness,
      taxSystem,
      addressLine1,
      addressLine2: addressLine2 || "",
      city,
      pinCode,
      country,
      state,
      stateCode,
      district,
      mobile,
      phone: phone || "",
      email,
      website: website || "",
      dateFormat,
      latitude: latitude || null,
      longitude: longitude || null,
      gstNo: gstNo || "",
      vatNo: vatNo || "",
      panNo: panNo || "",
      tanNo: tanNo || "",
      dlNo1: dlNo1 || "",
      dlNo2: dlNo2 || "",
      dealsIn: dealsIn || "",
      bankHolderName: bankHolderName || "",
      bankAccountNo: bankAccountNo || "",
      branchName: branchName || "",
      ifscCode: ifscCode || "",
      updated: new Date(),
    };

    const removeOldFile = (oldFile?: string | null): void => {
      if (!oldFile) return;
      fs.unlink(path.join("./Uploadimages", oldFile), (err) => {
        if (err) console.log("Old file delete failed:", err.message);
      });
    };

    const files = req.files as UploadedFiles | undefined;
    const logoFile = files?.logo?.[0];
    const iconFile = files?.icon?.[0];

    if (logoFile) {
      updatePayload.logo = "company_logo/" + logoFile.filename;
      removeOldFile(existing[0].logo);
    }

    if (iconFile) {
      updatePayload.icon = "company_logo/" + iconFile.filename;
      removeOldFile(existing[0].icon);
    }

    await updateModel("companydetails", updatePayload, {
      companyDetailsId,
      companyId,
    });

    return successResponse(res, {}, "Company details updated successfully.");
  } catch (error) {
    return errorResponse(res, "Something Went Wrong", error);
  }
};
