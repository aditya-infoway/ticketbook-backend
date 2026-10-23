import crypto from "crypto";
import fs from "fs";
import path from "path";
import axios from "axios";
import moment from "moment";
import type { Response } from "express";
import db from "../models/index";
import * as adminHelper from "./admin";

const Op = db.Sequelize.Op;

// ---------- Types ----------

type Row = Record<string, any>;
type WhereClause = Record<string, any>;
type OrderBy = [string, string][];

interface JoinTable {
  table: string;
  alias: string;
  onClause: any;
}

interface ApiResponse<T = unknown> {
  status: number;
  message: string;
  data?: T;
  error?: unknown;
  success?: boolean;
}

// ---------- Config ----------

// Base URL comes from .env (no trailing slash). Falls back to localhost for dev.
const BASE_URL = (
  process.env.BASE_URL || `http://localhost:${process.env.PORT || 8001}`
).replace(/\/+$/, "");
const UPLOAD_URL = `${BASE_URL}/Uploadimages/`;

// ---------- Responses ----------

export const successResponse = (
  res: Response,
  data: unknown = [],
  message = "success",
): void => {
  const payload: ApiResponse = { status: 200, message, data, success: true };
  res.send(payload);
};

export const errorResponse = (
  res: Response,
  errorMessage = "Something went wrong",
  error: unknown = {},
): void => {
  const payload: ApiResponse = {
    status: 400,
    message: mysql_unreal_escape_string(errorMessage),
    error,
    success: false,
  };
  res.send(payload);
  console.log(error);
};

export const requiredmessage = (res: Response, message: string): void => {
  res.send({ status: 400, message });
};

// ---------- String helpers ----------

export function cleanString(str?: string | null): string {
  return str || "";
}

export function mysql_unreal_escape_string(string?: string | null): string {
  return cleanString(string);
}

// NOTE: original code called `mysql_real_escape_string` which was never defined
// (ReferenceError at runtime). Replaced with mysql_unreal_escape_string.
export const cleanObject = (myObject: Row): Row => {
  Object.keys(myObject).forEach((key) => {
    if (myObject[key] == null) {
      myObject[key] = "";
    } else {
      myObject[key] = mysql_unreal_escape_string(myObject[key]);
    }
  });
  return myObject;
};

export const ucFirst = (string: string): string =>
  string.charAt(0).toUpperCase() + string.slice(1);

// check input blank or not
export const validateData = (data2: any): boolean => {
  const data = cleanString(data2);
  return data == null || data == undefined || data == "";
};

// ---------- URL helpers ----------

export const getBlobTempPublicUrl = (blobName?: string | null): string =>
  blobName == "" || blobName == undefined || blobName == null
    ? ""
    : UPLOAD_URL + blobName;

export const categoryURL = (blobName?: string | null): string =>
  blobName == "" || blobName == undefined || blobName == null
    ? ""
    : getBlobTempPublicUrl("icons/" + blobName);

export const videoUrl = (blobName?: string | null): string =>
  blobName == "" || blobName == undefined || blobName == null
    ? ""
    : getBlobTempPublicUrl("videos/" + blobName);

// DB relative path -> full URL
export const toFullUrl = (relativePath?: string | null): string | null => {
  if (!relativePath) return null;
  // remove leading "Uploadimages/" so it doesn't appear twice in the URL
  const cleanPath = relativePath.replace(/^Uploadimages[\\/]/, "");
  return UPLOAD_URL + cleanPath;
};

// ---------- Generators ----------

export const generateCode = (userId: number | string, string: string): string => {
  let code = "";
  const strlen = userId.toString().length;
  for (let i = 0; i < 7 - strlen; i++) {
    code += "0";
  }
  return string + code + userId;
};

// NOTE: original loop never re-checked the new id (could loop forever).
export const uniqueId = async (): Promise<string> => {
  let id = crypto.randomBytes(30).toString("hex");
  let check = await adminHelper.checktoken(id);
  while (check.length != 0) {
    id = crypto.randomBytes(30).toString("hex");
    check = await adminHelper.checktoken(id);
  }
  return id;
};

export function generateOTP(): string {
  const digits = "0123456789";
  let OTP = "";
  for (let i = 0; i < 4; i++) {
    OTP += digits[Math.floor(Math.random() * 10)];
  }
  return OTP;
}

export const generateBookingCode = async (): Promise<string> => {
  let code = "VB";
  const bookc = await selectWithJoins(
    "booking",
    [],
    { delete: 0 },
    ["bookingId"],
    [["bookingId", "DESC"]],
  );

  if (bookc.length > 0) {
    const next = (bookc[0]["bookingId"] + 1).toString();
    for (let i = 5; i > next.length; i--) {
      code += "0";
    }
    return code + next;
  }
  return code + "00001";
};

// ---------- Image ----------

// sharp was commented out in the original import; load lazily so the
// file compiles even if sharp isn't installed. `npm i sharp` to use this.
export const saveResizedImage = (filePath: string, filename: string): string => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sharp = require("sharp");
  sharp(filePath)
    .resize(100, 100, {
      fit: sharp.fit.inside,
      withoutEnlargement: true,
    })
    .toFormat("jpeg")
    .toFile(`./media/images/resized_${filename}`);

  return `resized_${filename}`;
};

export async function downloadImage(
  url: string,
  type: string = "Vehcile",
): Promise<string | undefined> {
  try {
    const ext = path.extname(new URL(url).pathname);
    let fileName = "vehicleProfile" + Date.now() + ext;

    if (type != "Vehcile") {
      fileName = "vendor" + Date.now() + ext;
    }

    const filePath = path.join("./Uploadimages/", fileName);

    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise<string>((resolve, reject) => {
      writer.on("finish", () => resolve(fileName));
      writer.on("error", reject);
    });
  } catch (error: any) {
    console.error("Error downloading the image:", error.message);
  }
}

// ---------- DB helpers ----------

export const updateModel = async (
  model: string,
  query: Row = {},
  condition: WhereClause,
) => {
  const joinedModel = db[model];
  return await joinedModel.update(query, { where: condition });
};

export const saveModel = async (tableName: string, payload: Row): Promise<Row> => {
  const model = db[tableName];
  const data = await model.create(payload);
  return data.dataValues;
};

export const getResult = async (query: string): Promise<Row[]> => {
  return await db.sequelize.query(query, {
    type: db.sequelize.QueryTypes.SELECT,
  });
};

export const selectWithJoins = async (
  tableName: string,
  joinTables: JoinTable[] = [],
  whereClause: WhereClause = {},
  attributes: string[] = [],
  order: OrderBy = [],
  limit: number | null = null,
): Promise<Row[]> => {
  const model = db[tableName];

  const options: Row = {
    where: whereClause,
    attributes: attributes.length ? attributes : undefined,
    order: order.length ? order : undefined,
    raw: true,
  };

  if (limit != null && limit != undefined) {
    options["limit"] = limit;
  }

  joinTables.forEach(({ table, alias, onClause }) => {
    const joinedModel = db[table];
    options.include = options.include || [];
    options.include.push({
      model: joinedModel,
      as: alias,
      required: true,
      on: onClause,
    });
  });

  return await model.findAll(options);
};

// left join function
export const selectWithJoinsV2 = async (
  tableName: string,
  joinClauses: JoinTable[],
  whereClauses: WhereClause | null,
  selectColumns: string[],
  orderBy: OrderBy,
  limit?: number | null,
  offset?: number | null,
): Promise<Row[]> => {
  const joinString = joinClauses
    .map(({ table, alias, onClause }) => {
      const onString = Object.entries(onClause)
        .map(([leftKey, rightValue]: [string, any]) => {
          const rightKey = Object.keys(rightValue)[0];
          const column = rightValue[rightKey];
          return `${leftKey} = ${column}`;
        })
        .join(" AND ");
      return `LEFT JOIN ${table} AS ${alias} ON ${onString}`;
    })
    .join(" ");

  const whereString = whereClauses
    ? `WHERE ${Object.entries(whereClauses)
        .map(([key, value]) => {
          if (typeof value === "object" && value !== null) {
            const operator = Object.keys(value)[0];
            const columnValue = value[operator];

            if (operator.toUpperCase() === "IN") {
              return `${key} IN ${columnValue}`;
            }
            return `${key} ${operator} '${columnValue}'`;
          }
          return `${key} = '${value}'`;
        })
        .join(" AND ")}`
    : "";

  const selectString = selectColumns.join(", ");

  const orderByString =
    orderBy.length != 0
      ? `ORDER BY ${orderBy.map((column) => `${column[0]} ${column[1]}`).join(", ")}`
      : "";

  const limitString =
    limit && limit > 0
      ? offset && offset > 0
        ? `LIMIT ${offset + "," + limit}`
        : `LIMIT ${limit}`
      : "";

  const query = `SELECT ${selectString} FROM ${tableName} ${joinString} ${whereString} ${orderByString} ${limitString}`;
  return await getResult(query);
};

export const selectWithJoinsOrV2 = async (
  tableName: string,
  joinClauses: JoinTable[],
  whereClauses: WhereClause | null,
  selectColumns: string[],
  orderBy: OrderBy = [],
  limit?: number | null,
  offset?: number | null,
): Promise<Row[]> => {
  const joinString = joinClauses
    .map(({ table, alias, onClause }) => {
      const onString = Object.entries(onClause)
        .map(([leftKey, rightValue]: [string, any]) => {
          const rightKey = Object.keys(rightValue)[0];
          const column = rightValue[rightKey];
          return `${leftKey} = ${column}`;
        })
        .join(" AND ");
      return `LEFT JOIN ${table} AS ${alias} ON ${onString}`;
    })
    .join(" ");

  const whereString = whereClauses
    ? `WHERE ${Object.entries(whereClauses)
        .map(([key, value]) => {
          if (key == "or") {
            return `(${Object.entries(value as Row)
              .map(([, orItem]) => {
                const inkey = Object.keys(orItem)[0];
                const invalue = orItem[inkey];
                if (typeof invalue === "object" && invalue !== null) {
                  const operator = Object.keys(invalue)[0];
                  const columnValue = invalue[operator];
                  return `${inkey} ${operator} '${columnValue}'`;
                }
                return `${inkey} = '${invalue}'`;
              })
              .join(" OR ")})`;
          }
          if (typeof value === "object" && value !== null) {
            const operator = Object.keys(value)[0];
            const columnValue = value[operator];
            return `${key} ${operator} '${columnValue}'`;
          }
          return `${key} = '${value}'`;
        })
        .join(" AND ")}`
    : "";

  const selectString = selectColumns.join(", ");

  const orderByString =
    orderBy.length != 0
      ? `ORDER BY ${orderBy.map((column) => `${column[0]} ${column[1]}`).join(", ")}`
      : "";

  // NOTE: MySQL expects `LIMIT x OFFSET y` (OFFSET after LIMIT). Kept as original.
  const limitString =
    limit && limit > 0
      ? offset && offset > 0
        ? `OFFSET ${offset} LIMIT ${limit}`
        : `LIMIT ${limit}`
      : "";

  const query = `SELECT ${selectString} FROM ${tableName} ${joinString} ${whereString} ${orderByString} ${limitString}`;
  return await getResult(query);
};

// ---------- Uniqueness checks ----------

const checkUnique = async (
  tableName: string,
  idField: string,
  field: string,
  value: any,
  id?: number,
): Promise<number> => {
  if (value == "" || value == null || value == undefined) return 0;

  let whereClause: WhereClause = { [field]: value, delete: 0 };
  if (id && id > 0) {
    whereClause = {
      [idField]: { [Op.ne]: id },
      [field]: value,
      delete: 0,
    };
  }
  const res = await selectWithJoins(tableName, [], whereClause, [idField], [], null);
  return res.length > 0 ? res[0][idField] : 0;
};

export const checkemail = (email: string, userId?: number) =>
  checkUnique("user", "userId", "email", email, userId);

export const checkmobile = (mobileNumber: string, userId?: number) =>
  checkUnique("user", "userId", "mobileNumber", mobileNumber, userId);

export const checkvendoremail = (email: string, vendorId?: number) =>
  checkUnique("vendor", "vendorId", "email", email, vendorId);

export const checkvendormobile = (mobileNumber: string, vendorId?: number) =>
  checkUnique("vendor", "vendorId", "mobileNumber", mobileNumber, vendorId);

export const checkEmail = async (
  table: string,
  email: string,
  atr: string[] | "",
  obj: Record<string, number>,
): Promise<any> => {
  if (email == "" || email == null || email == undefined) return 0;

  const str = Object.keys(obj)[0];
  const objVal = obj[str];

  let whereClause: WhereClause = { email, delete: 0 };
  if (objVal > 0) {
    whereClause = { email, delete: 0, [str]: { [Op.ne]: objVal } };
  }
  const attributes = atr == "" ? [] : atr;
  const res = await selectWithJoins(table, [], whereClause, attributes, [], null);
  return res.length > 0 ? res[0][attributes[0]] : 0;
};

// ---------- Cart / Coupon ----------

export const cartitemstotal = async (userId: number | string) => {
  const data: Row[] = [];
  let subtotal = 0;
  const tableName = "cart";
  const whereClause = { "sto.delete": 0, "cart.userId": userId };
  const joinTables: JoinTable[] = [
    {
      table: "stock",
      alias: "sto",
      onClause: { "sto.stockId": { "=": "cart.productvariantId" } },
    },
    {
      table: "product",
      alias: "p",
      onClause: { "p.productId": { "=": "sto.productId" } },
    },
  ];
  const attributes = [
    "cart.cartId",
    "sto.stockId",
    "sto.productId",
    "p.name",
    "sto.price",
    "sto.quantity AS stocks",
    "cart.quantity",
    "sto.combination",
    "(SELECT `image` FROM `image` WHERE `productId`=`sto`.`productId` ORDER BY `imageId` LIMIT 1)AS `image`",
  ];
  const order: OrderBy = [["cart.cartId", "DESC"]];

  const getproduct = await selectWithJoinsV2(
    tableName,
    joinTables,
    whereClause,
    attributes,
    order,
    null,
    0,
  );

  for (const item of getproduct) {
    let stockmessage = "";
    const combo: { name: string; value: any }[] = [];
    const combination = JSON.parse(item["combination"]);
    const combinationarray = Object.entries(combination);

    for (const [variantId, value] of combinationarray) {
      const variantName = await selectWithJoins(
        "variant",
        [],
        { variantId },
        ["name"],
        [],
        null,
      );
      if (variantName.length > 0) {
        combo.push({ name: variantName[0]["name"], value });
      }
    }

    subtotal += item["price"] * item["quantity"];

    if (item["stocks"] == 0) {
      stockmessage = "Product Is Out Of Stock";
    } else if (item["stocks"] < item["quantity"]) {
      stockmessage = "Available Stock Is " + item["stocks"];
    }

    data.push({
      cartId: item["cartId"],
      productId: item["productId"],
      productvariantId: item["stockId"],
      name: item["name"],
      price: "$ " + item["price"],
      quantity: item["quantity"],
      image: getBlobTempPublicUrl(item["image"]),
      stockmessage,
      combination: combo,
    });
  }

  const total = subtotal;
  const discount = 0;

  return [
    {
      subtotal: "$ " + subtotal,
      discount: "$ " + discount,
      total: "$ " + total,
      cartItems: data,
    },
  ];
};

// [couponId, type, totalAmount, discount]
export type CouponResult = [number, string, number, number];

export const checkcouponfororder = async (
  couponId: number | string,
  alloverprice: number,
): Promise<CouponResult> => {
  const today = moment().format("YYYY-MM-DD");

  const chkcoupon = await getResult(
    "SELECT `couponId`,`type`,`discount`,`maxDiscount` FROM `coupon` WHERE `couponId`='" +
      couponId +
      "' AND `startDate`<='" +
      today +
      "' AND `endDate`>='" +
      today +
      "' AND `minOrderAmount`<='" +
      alloverprice +
      "'",
  );

  if (chkcoupon.length === 0) return [0, "None", alloverprice, 0];

  const c = chkcoupon[0];
  if (c["type"] == "FLAT") {
    return [c["couponId"], c["type"], alloverprice - c["discount"], c["discount"]];
  }

  const dis = (alloverprice / 100) * c["discount"];
  const disco = dis > c["maxDiscount"] ? c["maxDiscount"] : parseInt(String(dis));
  return [c["couponId"], c["type"], alloverprice - parseInt(String(disco)), parseInt(String(disco))];
};

export const checkcouponfororderwithvendor = async (
  couponId: number | string,
  alloverprice: number,
  userId: number | string,
): Promise<CouponResult> => {
  const today = moment().format("YYYY-MM-DD");

  const chkcoupon = await getResult(
    "SELECT `couponId`,`type`,`discount`,`minOrderAmount`,`maxDiscount`,`vendorId` FROM `coupon` WHERE `couponId`='" +
      couponId +
      "' AND `startDate`<='" +
      today +
      "' AND `endDate`>='" +
      today +
      "' ",
  );

  if (chkcoupon.length === 0) return [0, "None", alloverprice, 0];

  const c = chkcoupon[0];
  let newprice = 0;

  if (c["vendorId"] > 0) {
    const getvenpro = await getResult(
      "SELECT `cart`.`quantity`,`stock`.`price` FROM `cart` LEFT JOIN `stock` ON `cart`.`productvariantId`=`stock`.`stockId` LEFT JOIN `product` ON `product`.`productId`=`stock`.`productId` WHERE `cart`.`userId`='" +
        userId +
        "' AND `product`.`vendorId`='" +
        c["vendorId"] +
        "'",
    );

    if (getvenpro.length === 0) return [0, "None", alloverprice, 0];

    for (const p of getvenpro) {
      newprice += parseFloat(p["price"]) * parseFloat(p["quantity"]);
    }
  } else {
    newprice = alloverprice;
  }

  if (newprice < c["minOrderAmount"]) return [0, "None", alloverprice, 0];

  if (c["type"] == "FLAT") {
    const totalAmount = alloverprice - newprice + (newprice - c["discount"]);
    return [c["couponId"], c["type"], totalAmount, c["discount"]];
  }

  const dis = (newprice / 100) * c["discount"];
  const disco = dis > c["maxDiscount"] ? c["maxDiscount"] : parseFloat(String(dis));
  // NOTE: kept original logic (uses c.discount, not disco, in totalAmount)
  const totalAmount = alloverprice - newprice + (newprice - c["discount"]);
  return [c["couponId"], c["type"], totalAmount, parseInt(String(disco))];
};

// ---------- Validators ----------

export const validPassword = (password: string): boolean => {
  // min 8 chars, at least one digit, one lowercase, one uppercase
  const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/;
  return passwordRegex.test(password);
};

export const validemail = (email: string): boolean => {
  const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?:\.[A-Z]{2,})?$/i;
  return emailRegex.test(email);
};

export const validPhoneNnumber = (phoneNumber: string): boolean => {
  const phoneNumberRegex = /^[1-9]{1}[0-9]{5,15}$/i;
  return phoneNumberRegex.test(phoneNumber);
};

// ---------- Misc ----------

export const deleteRecord = async (
  model: string,
  recordId: number | string,
): Promise<200 | 404 | 500> => {
  try {
    const joinedModel = db[model];
    const record = await joinedModel.findByPk(recordId);

    if (record) {
      await record.destroy();
      return 200;
    }
    return 404;
  } catch (error) {
    return 500;
  }
};

export const timeSince = (date: moment.MomentInput): string => {
  const a = moment();
  const b = moment(date);
  const seconds = a.diff(b, "seconds");

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
};

export const countryDetails = async (
  countryId?: number | null,
  field: string[] = [],
): Promise<Row[]> => {
  const where: WhereClause = { delete: 0 };
  if (countryId || countryId == 0) {
    where.countryId = countryId;
  }
  return await selectWithJoins("country", [], where, field);
};

// ---------- FCM / Notification ----------

export const getFCMToken = async (
  type: string = "USER",
  id: number | string,
): Promise<string> => {
  const fcm = await selectWithJoins(
    "fcmtoken",
    [],
    { delete: 0, recordId: id, recordType: type },
    ["token"],
    [["fcmtokenId", "DESC"]],
    1,
  );
  return fcm.length != 0 ? fcm[0]["token"] : "";
};

export const saveNotification = async (
  type: string,
  id: number | string,
  title: string,
  message: string,
): Promise<void> => {
  await saveModel("notification", { type, id, title, message });
};

export const numberFormate = (value: unknown): string => {
  const num = parseFloat(String(value));
  if (isNaN(num)) return "0.00";
  return num.toFixed(2);
};