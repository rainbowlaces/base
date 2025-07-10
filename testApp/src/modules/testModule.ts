// import { BaseClassConfig, type ConfigData } from "../../../src/core/config/types";
// import { configClass } from "../../../src/core/config/decorators/provider";
// import { BaseModule } from "../../../src/core/module/baseModule";
// import { baseModule } from "../../../src/core/module/decorators/baseModule";
// import { request } from "../../../src/core/module/decorators/request";
// import { type BaseHttpActionArgs } from "../../../src/core/module/types";
// import { di } from "../../../src/core/di/decorators/di";
// import { type BaseTemplates } from "../../../src/modules/templates/baseTemplates";

// @configClass('PingModule')
// export class PingModuleConfig extends BaseClassConfig {
//   pingMessage: string = 'Default ping message';
// }

// @baseModule
// export class PingModule extends BaseModule<PingModuleConfig> {
  
//   @di("BaseTemplates")
//   private accessor templates!: BaseTemplates;
  
//   @request("/get/ping")
//   async handlePing(args: BaseHttpActionArgs) {
//     const ctx = args.context;
    
//     this.logger.info("Ping request received", [ctx.id]);
    
//     // Send PONG response
//     await ctx.res.text(`PONG! ${this.config.pingMessage}`);
    
//     this.logger.debug("Ping response sent", [ctx.id]);
//   }

//   @request("/get/dashboard")
//   async getDashboard(args: BaseHttpActionArgs) {
//     const ctx = args.context;
    
//     this.logger.info("Serving dashboard", [ctx.id]);
    
//     const templateData = {
//       title: "RL-Base Test Application",
//       modules: [
//         {
//           name: "PingModule",
//           description: "Simple ping/pong service demonstrating basic request handling and configuration",
//           endpoints: [
//             "GET /get/ping - Returns PONG message",
//             "GET /get/dashboard - This dashboard page"
//           ]
//         },
//         {
//           name: "UserModule", 
//           description: "User management with full CRUD operations, validation, and HTML templates",
//           endpoints: [
//             "GET /get/users - List all users (JSON)",
//             "GET /get/user/:id - Get specific user (JSON)",
//             "POST /post/user - Create new user (JSON)",
//             "PUT /put/user/:id - Update user (JSON)",
//             "DELETE /delete/user/:id - Delete user (JSON)",
//             "GET /get/users/html - User management page (HTML)"
//           ]
//         },
//         {
//           name: "ProductModule",
//           description: "Product catalog with filtering, search, and template-based HTML views",
//           endpoints: [
//             "GET /get/products - List products with filtering (JSON)",
//             "GET /get/product/:id - Get specific product (JSON)",
//             "GET /get/products/categories - List categories (JSON)",
//             "GET /get/products/search - Search products (JSON)",
//             "GET /get/products/catalog - Product catalog page (HTML)",
//             "POST /post/product - Create new product (JSON)"
//           ]
//         }
//       ],
//       stats: {
//         totalModules: 3,
//         totalEndpoints: 12,
//         uptime: "N/A"
//       }
//     };
    
//     const template = this.templates.templateFactories.DashboardTemplate(templateData);
//     const html = await template.render();
    
//     await ctx.res.html(html);
//   }
// }

// // Declaration merging to add the ping config to the global app config type
// declare module "../../../src/core/config/types" {
//   interface BaseAppConfig {
//     PingModule?: ConfigData<PingModuleConfig>;
//   }
// }