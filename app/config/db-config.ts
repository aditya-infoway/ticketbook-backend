import dotenv from "dotenv";
import { Dialect } from "sequelize";

dotenv.config();

interface DbConfig {
  HOST: string | undefined;
  USER: string | undefined;
  PASSWORD: string | undefined;
  DB: string | undefined;
  PORT: number;
  dialect: Dialect;
  pool: {
    max: number;
    min: number;
    acquire: number;
    idle: number;
  };
  logging: boolean;
  define: {
    timestamps: boolean;
  };
}

const dbConfig: DbConfig = {
  HOST: process.env.DB_HOST,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASS,
  DB: process.env.DB_NAME,
  PORT: Number(process.env.DB_PORT) || 5432,

  dialect: "postgres",

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },

  logging: false,

  define: {
    timestamps: false,
  },
};

export default dbConfig;