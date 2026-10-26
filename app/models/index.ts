import { Sequelize } from "sequelize";
import dbConfig from "../config/db-config";
import defineAdmin from "./admin";
import defineCompany from "./company";
import defineCompanyDetails from "./companydetails";
import defineFinancialYear from "./financialyear";
import defineDepartmenttype from "./departmenttype";
const sequelize = new Sequelize(
  dbConfig.DB as string,
  dbConfig.USER as string,
  dbConfig.PASSWORD as string,
  {
    host: dbConfig.HOST,
    port: dbConfig.PORT,
    dialect: dbConfig.dialect,
    pool: dbConfig.pool,
    logging: dbConfig.logging,
    define: dbConfig.define,
  },
);

const db: any = {};

db.admin = defineAdmin(sequelize);
db.company = defineCompany(sequelize);
db.companydetails = defineCompanyDetails(sequelize);
db.financialyear = defineFinancialYear(sequelize);
db.departmenttype = defineDepartmenttype(sequelize);
db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;