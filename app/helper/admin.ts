import db from "../models/index";

export const checktoken = async (token: string): Promise<{ adminId: number }[]> => {
  const admin = await db.admin.findAll({
    where: { token },
    attributes: ["adminId"],
    raw: true,
  });
  return admin;
};