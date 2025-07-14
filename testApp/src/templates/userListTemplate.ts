import { template, BaseTemplate, type TemplateResult, html, type BaseModelCollection, type MaybeAsync } from "../../../src/index.js";
import { type User } from '../models/user.js';

export interface UserListTemplateData {
  users: MaybeAsync<BaseModelCollection<User>>;
}

@template()
export class UserListTemplate extends BaseTemplate<UserListTemplateData> {
  public render(): TemplateResult {
    // Prepare the content for the core page template
    const content = html`
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Created</th>
                </tr>
            </thead>
            <tbody>
                ${this.tags.each(this.data.users, {
                  do: (item: unknown) => {
                    const user = item as User;
                    return html`
                      <tr>
                          <td>${user.name}</td>
                          <td>${user.email}</td>
                          <td>
                              <span class="status ${user.active ? 'active' : 'inactive'}">
                                  ${user.active ? 'Active' : 'Inactive'}
                              </span>
                          </td>
                          <td>${user.created.toLocaleDateString()}</td>
                      </tr>
                    `;
                  }
                })}
            </tbody>
        </table>
    `;

    // Use the CorePageTemplate with our content
    return this.templates.CorePageTemplate({
      title: "Users",
      headerData: {
        title: "User Management",
        currentPage: "users"
      },
      content,
      footerData: {
        text: "🚀 User Management - Powered by Component Templates"
      }
    });
  }
}

declare module "../../../src/index.js" {
  interface Templates {
    UserListTemplate: UserListTemplate;
  }
}
