import multer from "multer";
import path from "path";
import fs from "fs";

export const createUploader = (
  subfolder: string,
  allowed: RegExp = /jpeg|jpg|png|webp|jfif/,
  invalidMessage = "Only image files (jpeg, jpg, png, webp, jfif) are allowed",
) => {
  const uploadPath = path.join("./Uploadimages", subfolder);

  // folder na ho to khud bana do
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, {
      recursive: true,
    });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadPath);
    },

    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);

      const uniqueName = subfolder + "_" + Date.now() + ext;

      cb(null, uniqueName);
    },
  });

  const fileFilter = (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    const isValid = allowed.test(path.extname(file.originalname).toLowerCase());

    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error(invalidMessage));
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  });
};
