import { template, BaseTemplate, type TemplateResult, html } from "../../../../src/index.js";

export interface HeaderTemplateData {
  title: string;
  currentPage?: string;
}

@template()
export class HeaderTemplate extends BaseTemplate<HeaderTemplateData> {
  public render(): TemplateResult {
    return html`
        <div class="header">
            <h1>${this.data.title}</h1>
        </div>
        
        <div class="nav">
            <a href="/dashboard" ${this.data.currentPage === 'dashboard' ? 'class="active"' : ''}>← Dashboard</a>
            <a href="/dashboard/users" ${this.data.currentPage === 'users' ? 'class="active"' : ''}>Users</a>
            <a href="/dashboard/articles" ${this.data.currentPage === 'articles' ? 'class="active"' : ''}>Articles</a>
            <a href="/dashboard/groups" ${this.data.currentPage === 'groups' ? 'class="active"' : ''}>Groups</a>
        </div>
        
        <style>
            .header { 
                background: linear-gradient(135deg, #2c3e50, #3498db);
                color: white; 
                padding: 30px; 
                text-align: center;
            }
            .header h1 { 
                margin: 0; 
                font-size: 2rem; 
            }
            .nav { 
                background: #f8f9fa;
                padding: 15px 30px; 
                border-bottom: 1px solid #e9ecef;
            }
            .nav a { 
                margin-right: 15px; 
                text-decoration: none; 
                color: #007bff; 
                font-weight: 500;
            }
            .nav a:hover { color: #0056b3; }
            .nav a.active { 
                color: #0056b3; 
                font-weight: 600;
                text-decoration: underline;
            }
        </style>
`;
  }
}

declare module "../../../../src/index.js" {
  interface Templates {
    HeaderTemplate: HeaderTemplate;
  }
}
