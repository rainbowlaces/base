import { template, BaseTemplate, type TemplateResult, html } from "../../../../src/index.js";
import { type GroupType } from '../../models/groupType.js';

export interface GroupTypeTemplateData {
  groupType: GroupType | null;
}

@template()
export class GroupTypeTemplate extends BaseTemplate<GroupTypeTemplateData> {
  public render(): TemplateResult {
    return html`
        ${this.tags.if(this.data.groupType !== null, {
          then: html`
            <span class="group-type">
                ${this.data.groupType!.name}
            </span>
          `,
          else: html`
            <span class="group-type no-type">
                No Type
            </span>
          `
        })}
        
        <style>
            .group-type {
                margin-top: 8px;
                padding: 4px 8px;
                background: #e3f2fd;
                color: #1976d2;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: 500;
                display: inline-block;
            }
            .group-type.no-type {
                background: #f5f5f5;
                color: #6c757d;
            }
        </style>
`;
  }
}

declare module "../../../../src/index.js" {
  interface Templates {
    GroupTypeTemplate: GroupTypeTemplate;
  }
}
