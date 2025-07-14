import { template, BaseTemplate, type TemplateResult, html } from "../../../src/index.js";


export interface DashboardTemplateData {
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
    <link rel="stylesheet" href="/static/main.css">
    <script src="/static/bundle.js"></script>
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
                          <div style="margin-top: 15px;">
                              <a href="/dashboard/${module.name.toLowerCase()}" style="background: #007bff; color: white; padding: 8px 15px; text-decoration: none; border-radius: 5px; font-size: 0.9rem;">View ${module.name}</a>
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

declare module "../../../src/index.js" {
  interface Templates {
    DashboardTemplate: DashboardTemplate;
  }
}
