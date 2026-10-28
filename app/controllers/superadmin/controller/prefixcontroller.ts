import { Request, Response } from "express";

import {
  errorResponse,
  successResponse,
  requiredmessage,
  saveModel,
  updateModel,
  selectWithJoins,
} from "../../../helper/index.js";

interface PrefixBody {
  prefixFor?: string;
  prefix?: string;
  prefixId?: number;
}

interface TokenCompanyRow {
  companyId: number;
}

// ---- GET COMPANY ID FROM TOKEN ----

const getCompanyIdFromToken = async (
  req: Request,
): Promise<number | null> => {
  const token =
    (req.headers["x-token"] as string) ||
    (req.headers["X-Token"] as string) ||
    "";

  if (!token) {
    return null;
  }

  const companyRows = (await selectWithJoins(
    "company",
    [],
    {
      token,
      delete: 0,
    },
    ["companyId"],
  )) as TokenCompanyRow[];

  if (!companyRows || companyRows.length === 0) {
    return null;
  }

  return companyRows[0].companyId;
};

// ---- CREATE ----

export const createPrefix = async (
  req: Request<{}, {}, PrefixBody>,
  res: Response,
): Promise<Response | void> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(
        res,
        "Unauthorized. Please login again.",
      );
    }

    const { prefixFor, prefix } = req.body;

    // Same company + same prefixFor already exists
    const existing = await selectWithJoins(
      "companyprefix",
      [],
      {
        companyId,
        prefixFor,
        delete: 0,
      },
      ["prefixId"],
    );

    if (existing.length > 0) {
      return errorResponse(
        res,
        `Prefix for "${prefixFor}" already exists. Please edit it instead.`,
      );
    }

    const payload = {
      companyId,
      prefixFor,
      prefix,
      delete: 0,
    };

    const data = await saveModel(
      "companyprefix",
      payload,
    );

    if (!data?.prefixId) {
      return errorResponse(
        res,
        "Failed to save prefix",
      );
    }

    return successResponse(
      res,
      data,
      "Prefix added successfully.",
    );
  } catch (error) {
    console.error("createPrefix error:", error);

    return errorResponse(
      res,
      "Something Went Wrong",
      error,
    );
  }
};

// ---- UPDATE ----

export const updatePrefix = async (
  req: Request<{}, {}, PrefixBody>,
  res: Response,
): Promise<Response | void> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(
        res,
        "Unauthorized. Please login again.",
      );
    }

    const {
      prefixId,
      prefixFor,
      prefix,
    } = req.body;

    const existing = await selectWithJoins(
      "companyprefix",
      [],
      {
        prefixId,
        companyId,
        delete: 0,
      },
      ["prefixId"],
    );

    if (!existing || existing.length === 0) {
      return requiredmessage(
        res,
        "Prefix not found.",
      );
    }

    await updateModel(
      "companyprefix",
      {
        prefixFor,
        prefix,
        updated: new Date(),
      },
      {
        prefixId,
        companyId,
      },
    );

    return successResponse(
      res,
      {},
      "Prefix updated successfully.",
    );
  } catch (error) {
    console.error("updatePrefix error:", error);

    return errorResponse(
      res,
      "Something Went Wrong",
      error,
    );
  }
};

// ---- LIST ----

export const getPrefixList = async (
  req: Request,
  res: Response,
): Promise<Response | void> => {
  try {
    const companyId = await getCompanyIdFromToken(req);

    if (!companyId) {
      return requiredmessage(
        res,
        "Unauthorized. Please login again.",
      );
    }

    const rows = await selectWithJoins(
      "companyprefix",
      [],
      {
        companyId,
        delete: 0,
      },
      [
        "prefixId",
        "prefixFor",
        "prefix",
        "created",
        "updated",
      ],
      [["prefixId", "DESC"]],
    );

    return successResponse(
      res,
      rows,
      "Prefix list fetched successfully.",
    );
  } catch (error) {
    console.error("getPrefixList error:", error);

    return errorResponse(
      res,
      "Something Went Wrong",
      error,
    );
  }
};