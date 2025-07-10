import { BaseTemplate } from "../../../src/modules/templates/baseTemplate";
import { template } from "../../../src/modules/templates/decorators/template";
import { html } from "../../../src/modules/templates/engine/html";
import { type TemplateResult } from "../../../src/modules/templates/engine/templateResult";

interface DashboardTemplateData {
  title: string;
  modules: {
    name: string;
    description: string;
    endpoints: string[];
  }[];
  stats: {
    totalModules: number;
    totalEndpoints: number;
    uptime: string;
  };
}

@template()
export class DashboardTemplate extends BaseTemplate<DashboardTemplateData> {
  public render(): TemplateResult {
    return html`
<!DOCTYPE html>
<html>
<head>
    <title>${this.data.title}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(135deg, #2c3e50, #3498db);
            color: white; 
            padding: 40px; 
            text-align: center;
        }
        .header h1 { 
            margin: 0; 
            font-size: 2.5rem; 
            font-weight: 300;
        }
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 0;
            background: #f8f9fa;
        }
        .stat-card { 
            padding: 30px; 
            text-align: center;
            border-right: 1px solid #e9ecef;
        }
        .stat-card:last-child { border-right: none; }
        .stat-number { 
            font-size: 2.5rem; 
            font-weight: bold; 
            color: #2c3e50;
            margin-bottom: 5px;
        }
        .stat-label { 
            color: #6c757d; 
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .modules { 
            padding: 40px; 
        }
        .modules h2 { 
            color: #2c3e50;
            margin-bottom: 30px;
            font-size: 1.8rem;
            font-weight: 300;
        }
        .modules-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); 
            gap: 25px; 
        }
        .module-card { 
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .module-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        }
        .module-card h3 { 
            color: #2c3e50;
            margin: 0 0 15px 0;
            font-size: 1.4rem;
        }
        .module-card p { 
            color: #6c757d;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        .endpoints { 
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .endpoint { 
            background: #f8f9fa;
            padding: 8px 12px;
            margin-bottom: 5px;
            border-radius: 5px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.85rem;
            color: #495057;
            border-left: 3px solid #007bff;
        }
        .endpoint:last-child { margin-bottom: 0; }
        .footer {
            background: #2c3e50;
            color: white;
            text-align: center;
            padding: 20px;
            font-size: 0.9rem;
        }
        .badge {
            background: #007bff;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 500;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${this.data.title}</h1>
            <p>Framework demonstration application showcasing core features</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${this.data.stats.totalModules}</div>
                <div class="stat-label">Active Modules</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.data.stats.totalEndpoints}</div>
                <div class="stat-label">API Endpoints</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.data.stats.uptime}</div>
                <div class="stat-label">Uptime</div>
            </div>
        </div>
        
        <div class="modules">
            <h2>Available Modules</h2>
            <div class="modules-grid">
                ${this.tags.each(this.data.modules, {
                  do: (item: unknown) => {
                    const module = item as DashboardTemplateData['modules'][0];
                    return html`
                      <div class="module-card">
                          <h3>${module.name}<span class="badge">${module.endpoints.length}</span></h3>
                          <p>${module.description}</p>
                          <div class="endpoints">
                              ${this.tags.each(module.endpoints, {
                                do: (endpointItem: unknown) => {
                                  const endpoint = endpointItem as string;
                                  return html`<div class="endpoint">${endpoint}</div>`;
                                }
                              })}
                          </div>
                      </div>
                    `;
                  }
                })}
            </div>
        </div>
        
        <div class="footer">
            <p>🚀 RL-Base Framework Test Application - Demonstrating BaseModule, BaseTemplates, DI, and Configuration</p>
        </div>
    </div>
</body>
</html>
`;
  }
}

declare module "../../../src/modules/templates/types" {
  interface Templates {
    DashboardTemplate: DashboardTemplate;
  }
}
