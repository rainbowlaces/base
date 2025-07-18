import { template, BaseTemplate, type TemplateResult, html, type BaseModelCollection, type MaybeAsync } from "../../../../src/index.js";
import { type User } from '../../models/user.js';

export interface MemberListTemplateData {
  members: MaybeAsync<BaseModelCollection<User>>;
}

@template()
export class MemberListTemplate extends BaseTemplate<MemberListTemplateData> {
  public render(): TemplateResult {
    return html`
        <div class="members-section">
            <div class="members-header">
                Members
            </div>
            <div class="members-list">
                ${this.tags.each(this.data.members, {
                  do: (item: unknown) => {
                    const user = item as User;
                    return html`
                      <div class="member">
                          <div class="member-info">
                              <div class="member-name">${user.name}</div>
                              <div class="member-email">${user.email}</div>
                          </div>
                          <div class="member-status">
                              <span class="status ${user.active ? 'active' : 'inactive'}">
                                  ${user.active ? 'Active' : 'Inactive'}
                              </span>
                          </div>
                      </div>
                    `;
                  }
                })}
            </div>
        </div>
        
        <style>
            .members-section {
                padding: 0;
            }
            .members-header {
                padding: 15px 20px;
                font-weight: 600;
                color: #2c3e50;
                border-bottom: 1px solid #e9ecef;
                background: #f8f9fa;
            }
            .members-list {
                padding: 0;
            }
            .member {
                padding: 15px 20px;
                border-bottom: 1px solid #e9ecef;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .member:last-child {
                border-bottom: none;
            }
            .member:hover {
                background: #f8f9fa;
            }
            .member-name {
                font-weight: 600;
                color: #2c3e50;
            }
            .member-email {
                color: #6c757d;
                font-size: 0.9rem;
            }
            .status {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: 500;
            }
            .status.active {
                background: #d4edda;
                color: #155724;
            }
            .status.inactive {
                background: #f8d7da;
                color: #721c24;
            }
        </style>
`;
  }
}

declare module "../../../../src/index.js" {
  interface Templates {
    MemberListTemplate: MemberListTemplate;
  }
}
