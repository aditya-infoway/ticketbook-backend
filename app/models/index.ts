import { Sequelize } from "sequelize";
import dbConfig from "../config/db-config";
import defineAdmin from "./admin";
import defineCompany from "./company";
import defineCompanyDetails from "./companydetails";
import defineFinancialYear from "./financialyear";
import defineDepartmenttype from "./departmenttype";
import regiontype from "./regiontype";
import defineDepartment from "./department";
import defineCompanyPrefix from "./companyprefix";
import defineregion from "./region";
import definerolecategory from "./rolecategory";
import definerole from "./role";
import defineroledepartment from "./roledepartment";
import definebranch from "./branch";
import defineemployeetype from "./employeetype";
import defineemployee from "./employee";
import defineemployeedepartment from "./employeedepartment";
import defineresolverteam from "./resolverteam";
import defineticketcategory from "./ticketcategory";
import defineticketstatus from "./ticketstatus";
import defineticket from "./ticket";
import definecontractordepartment from "./contractordepartment";
import definecontractor from "./contractor";

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
db.regiontype = regiontype(sequelize);
db.department = defineDepartment(sequelize);
db.companyprefix = defineCompanyPrefix(sequelize);
db.region = defineregion(sequelize);
db.rolecategory = definerolecategory(sequelize);
db.role = definerole(sequelize);
db.roledepartment = defineroledepartment(sequelize);
db.employee = defineemployee(sequelize);
db.employeedepartment = defineemployeedepartment(sequelize);
db.resolverteam = defineresolverteam(sequelize);
db.ticketcategory = defineticketcategory(sequelize);
db.ticketstatus = defineticketstatus(sequelize);
db.ticket = defineticket(sequelize);
db.contractordepartment = definecontractordepartment(sequelize);
db.contractor = definecontractor(sequelize);

db.branch = definebranch(sequelize);
db.employeetype = defineemployeetype(sequelize);
db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
