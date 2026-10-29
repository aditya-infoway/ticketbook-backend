import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";
import "multer";

import {
  errorResponse,
  successResponse,
  requiredmessage,
  updateModel,
  selectWithJoins,
  getBlobTempPublicUrl,
} from "../../../helper/index";

const toText = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v).trim();

const getIds = (req: Request) => ({
  branchId: Number((req as any).branchId) || 0,
  companyId: Number((req as any).companyId) || 0,
});

// Purani photo disk se hatao (naya upload hone par)
const removeOldFile = (oldFile?: string | null): void => {
  if (!oldFile) return;
  fs.unlink(path.join("./Uploadimages", oldFile), (err) => {
    if (err) console.log("Old file delete failed:", err.message);
  });
};

// ---- My branch profile ----
export const getMyBranchProfile = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { branchId, companyId } = getIds(req);
    if (!branchId || !companyId)
      return requiredmessage(res, "Unauthorized. Please login again.");

    const rows: any[] = await selectWithJoins(
      "branch",
      [],
      { branchId, companyId, delete: 0 },
      [
        "branchNo",
        "branchCode",
        "branchName",
        "profilePhoto",
        "branchEmail",
        "regionId",
        "country",
        "state",
        "city",
        "fullAddress",
        "pinCode",
        "contactNumber",
        "phoneNumber",
        "branchManagerId",
        "areaManagerId",
        "openingDate",
        "workingHours",
        "status",
      ],
    );
    if (!rows.length) return requiredmessage(res, "Branch not found.");
    const r = rows[0];

    const regions: any[] = r.regionId
      ? await selectWithJoins(
          "region",
          [],
          { regionId: r.regionId, companyId, delete: 0 },
          ["regionName"],
        )
      : [];
    const empName = async (id: any): Promise<string> => {
      if (!id) return "";
      const e: any[] = await selectWithJoins(
        "employee",
        [],
        { employeeId: id, companyId, delete: 0 },
        ["employeeName"],
      );
      return e[0]?.employeeName || "";
    };

    return successResponse(
      res,
      {
        branchNo: r.branchNo || "",
        branchCode: r.branchCode || "",
        branchName: r.branchName || "",
        profilePhoto: r.profilePhoto
          ? getBlobTempPublicUrl(r.profilePhoto)
          : "",
        branchEmail: r.branchEmail || "",
        region: regions[0]?.regionName || "",
        country: r.country || "",
        state: r.state || "",
        city: r.city || "",
        fullAddress: r.fullAddress || "",
        pinCode: r.pinCode || "",
        contactNumber: r.contactNumber || "",
        phoneNumber: r.phoneNumber || "",
        branchManager: await empName(r.branchManagerId),
        areaManager: await empName(r.areaManagerId),
        openingDate: r.openingDate || "",
        workingHours: r.workingHours || "",
        status: r.status || "",
      },
      "Profile fetched successfully.",
    );
  } catch (error) {
    console.error("getMyBranchProfile error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update my branch profile (photo, contact, address, password only) ----
export const updateMyBranchProfile = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { branchId, companyId } = getIds(req);
    if (!branchId || !companyId)
      return requiredmessage(res, "Unauthorized. Please login again.");

    const body = req.body as Record<string, any>;

    const existing: any[] = await selectWithJoins(
      "branch",
      [],
      { branchId, companyId, delete: 0 },
      ["branchId", "password", "profilePhoto"],
    );
    if (!existing.length) return requiredmessage(res, "Branch not found.");

    const payload: Record<string, any> = {
      contactNumber: toText(body.contactNumber),
      phoneNumber: toText(body.phoneNumber),
      fullAddress: toText(body.fullAddress),
      pinCode: toText(body.pinCode),
      updatedBy: String(branchId),
      updated: new Date(),
    };

    // Password change: purana password sahi hona chahiye
    if (body.newPassword) {
      const ok = existing[0].password
        ? await bcrypt.compare(
            String(body.currentPassword || ""),
            existing[0].password,
          )
        : false;
      if (!ok) return errorResponse(res, "Current password is incorrect.");
      payload.password = await bcrypt.hash(String(body.newPassword), 10);
    }

    // Photo tabhi badlo jab nayi bheji ho (warna purani waise hi rahegi)
    const photoFile = (req as any).file as Express.Multer.File | undefined;
    if (photoFile) {
      payload.profilePhoto = "branch_photo/" + photoFile.filename;
      removeOldFile(existing[0].profilePhoto);
    }

    await updateModel("branch", payload, { branchId, companyId });
    return successResponse(res, {}, "Profile updated successfully.");
  } catch (error) {
    console.error("updateMyBranchProfile error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};