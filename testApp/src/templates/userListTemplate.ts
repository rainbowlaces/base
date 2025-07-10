import { BaseTemplate } from "../../../src/modules/templates/baseTemplate";
import { template } from "../../../src/modules/templates/decorators/template";
import { html } from "../../../src/modules/templates/engine/html";
import { type TemplateResult } from "../../../src/modules/templates/engine/templateResult";

interface User {
  id: string; // Changed from number to string for UniqueID
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  active: boolean; // Added active field
}

interface UserListTemplateData {
  users: User[];
  maxUsers: number;
  defaultRole: string;
  requireEmailVerification: boolean;
}

@template()
export class UserListTemplate extends BaseTemplate<UserListTemplateData> {
  public render(): TemplateResult {
    return html`
<!DOCTYPE html>
<html>
<head>
    <title>Users</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .header { margin-bottom: 20px; }
        .stats { background: #f9f9f9; padding: 10px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>User Management</h1>
        <div class="stats">
            <p>Total Users: ${this.data.users.length} / ${this.data.maxUsers}</p>
            <p>Default Role: ${this.data.defaultRole}</p>
            <p>Email Verification: ${this.data.requireEmailVerification ? 'Required' : 'Not Required'}</p>
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
            </tr>
        </thead>
        <tbody>
            ${this.tags.each(this.data.users, {
              do: (item: unknown) => {
                const user = item as User;
                return html`
                  <tr>
                      <td>${user.id}</td>
                      <td>${user.name}</td>
                      <td>${user.email}</td>
                      <td>${user.role}</td>
                      <td>${user.createdAt.toLocaleDateString()}</td>
                  </tr>
                `;
              }
            })}
        </tbody>
    </table>
</body>
</html>
`;
  }
}

declare module "../../../src/modules/templates/types" {
  interface Templates {
    UserListTemplate: UserListTemplate;
  }
}
