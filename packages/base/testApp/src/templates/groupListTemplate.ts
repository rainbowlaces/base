import { template, BaseTemplate, type TemplateResult, html, type BaseModelCollection, type MaybeAsync, type MaybeOptionalAsync } from "../../../src/index.js";
import { type Group } from '../models/group.js';
import { type GroupType } from "../models/groupType.js";

export interface GroupListTemplateData {
  groups: MaybeAsync<BaseModelCollection<Group>>;
}

@template()
export class GroupListTemplate extends BaseTemplate<GroupListTemplateData> {
  public render(): TemplateResult {
    // Prepare the content for the core page template
    const content = html`
        ${this.tags.each(this.data.groups, {
          do: (item: unknown) => {
            const group = item as Group;
            return html`
              <div class="group">
                  <div class="group-header">
                      <h2 class="group-title">${group.name}</h2>
                      ${this.templates.GroupTypeTemplate({
                        groupType: group.type() as MaybeOptionalAsync<GroupType>
                      })}
                  </div>
                  ${this.templates.MemberListTemplate({
                    members: group.members()
                  })}
              </div>
            `;
          }
        })}
    `;

    // Use the CorePageTemplate with our content
    return this.templates.CorePageTemplate({
      title: "Groups",
      headerData: {
        title: "Group Management",
        currentPage: "groups"
      },
      content,
      footerData: {
        text: "🚀 Group Management - Powered by Component Templates"
      }
    });
  }
}

declare module "../../../src/index.js" {
  interface Templates {
    GroupListTemplate: GroupListTemplate;
  }
}
