import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import fs from "fs";

import {
  errorResponse,
  successResponse,
  requiredmessage,
  updateModel,
  selectWithJoins,
} from "../../../helper/index";

const toText = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v).trim();

// branchManagerAuth middleware req.branchManagerId set karta hai
const getMyId = (req: Request): number =>
  Number((req as any).branchManagerId) || 0;

const toPublicUrl = (req: Request, storedPath?: string | null): string => {
  if (!storedPath) return "";
  const clean = String(storedPath).replace(/\\/g, "/").replace(/^\/+/, "");
  return `${req.protocol}://${req.get("host")}/${clean}`;
};

const removeUploaded = (file?: Express.Multer.File) => {
  if (file?.path) fs.unlink(file.path, () => {});
};

const removeStoredFile = (storedPath?: string | null) => {
  if (!storedPath) return;
  const normalized = String(storedPath).replace(/\\/g, "/");
  if (!normalized.includes("Uploadimages/branchmanager/")) return;
  fs.unlink(normalized, () => {});
};

// ---- My profile ----
export const getMyProfile = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const branchManagerId = getMyId(req);
    if (!branchManagerId)
      return requiredmessage(res, "Unauthorized. Please login again.");

    const rows: any[] = await selectWithJoins(
      "branchmanager",
      [],
      { branchManagerId, delete: 0 },
      [
        "branchManagerNo",
        "companyId",
        "name",
        "profilePhoto",
        "gender",
        "mobileNumber",
        "alternateMobile",
        "email",
        "address",
        "city",
        "state",
        "pinCode",
        "areaId",
        "branchId",
        "reportingTo",
        "joiningDate",
        "status",
      ],
    );
    if (!rows.length) return requiredmessage(res, "Branch manager not found.");
    const r = rows[0];

    const [regions, branches, managers]: any[][] = await Promise.all([
      selectWithJoins(
        "region",
        [],
        { regionId: r.areaId, companyId: r.companyId, delete: 0 },
        ["regionName"],
      ),
      selectWithJoins(
        "branch",
        [],
        { branchId: r.branchId, companyId: r.companyId, delete: 0 },
        ["branchName"],
      ),
      selectWithJoins(
        "areamanager",
        [],
        { areaManagerId: r.reportingTo, companyId: r.companyId, delete: 0 },
        ["name"],
      ),
    ]);

    return successResponse(
      res,
      {
        branchManagerNo: r.branchManagerNo || "",
        name: r.name || "",
        profilePhoto: toPublicUrl(req, r.profilePhoto),
        gender: r.gender || "",
        email: r.email || "",
        mobileNumber: r.mobileNumber || "",
        alternateMobile: r.alternateMobile || "",
        address: r.address || "",
        city: r.city || "",
        state: r.state || "",
        pinCode: r.pinCode || "",
        areaName: regions[0]?.regionName || "",
        branchName: branches[0]?.branchName || "",
        reportingToName: managers[0]?.name || "",
        joiningDate: r.joiningDate || "",
        status: r.status || "",
      },
      "Profile fetched successfully.",
    );
  } catch (error) {
    console.error("getMyProfile (branchManager) error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};

// ---- Update my profile (name, phones, photo, password only) ----
export const updateMyProfile = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const reject = (message: string) => {
    removeUploaded(req.file);
    return errorResponse(res, message);
  };

  try {
    const branchManagerId = getMyId(req);
    if (!branchManagerId) {
      removeUploaded(req.file);
      return requiredmessage(res, "Unauthorized. Please login again.");
    }

    const body = req.body as Record<string, any>;

    const existing: any[] = await selectWithJoins(
      "branchmanager",
      [],
      { branchManagerId, delete: 0 },
      ["branchManagerId", "companyId", "password", "profilePhoto"],
    );
    if (!existing.length) return reject("Branch manager not found.");
    const me = existing[0];

    const name = toText(body.name);
    if (!name) return reject("Name is required.");

    const mobile = toText(body.mobileNumber);
    const alt = toText(body.alternateMobile);
    if (!/^[6-9]\d{9}$/.test(mobile))
      return reject("Mobile number must be a valid 10-digit number.");
    if (alt && !/^[6-9]\d{9}$/.test(alt))
      return reject("Alternate mobile must be a valid 10-digit number.");

    // mobile company ke andar unique hona chahiye
    const sameCompany: any[] = await selectWithJoins(
      "branchmanager",
      [],
      { companyId: me.companyId, delete: 0 },
      ["branchManagerId", "mobileNumber"],
    );
    const taken = sameCompany.some(
      (r) =>
        Number(r.branchManagerId) !== branchManagerId &&
        String(r.mobileNumber || "").trim() === mobile,
    );
    if (taken) return reject("Mobile number is already registered.");

    const payload: Record<string, any> = {
      name,
      mobileNumber: mobile,
      alternateMobile: alt,
      updatedBy: String(branchManagerId),
      updated: new Date(),
    };

    // Password change: purana password sahi hona chahiye
    if (body.newPassword) {
      if (String(body.newPassword).length < 6)
        return reject("New password must be at least 6 characters.");
      if (body.newPassword !== body.confirmPassword)
        return reject("Passwords do not match.");
      const ok = me.password
        ? await bcrypt.compare(String(body.currentPassword || ""), me.password)
        : false;
      if (!ok) return reject("Current password is incorrect.");
      payload.password = await bcrypt.hash(String(body.newPassword), 10);
    }

    if (req.file) payload.profilePhoto = req.file.path.replace(/\\/g, "/");

    await updateModel("branchmanager", payload, { branchManagerId });

    if (req.file) removeStoredFile(me.profilePhoto);

    return successResponse(res, {}, "Profile updated successfully.");
  } catch (error) {
    removeUploaded(req.file);
    console.error("updateMyProfile (branchManager) error:", error);
    return errorResponse(res, "Something Went Wrong", error);
  }
};