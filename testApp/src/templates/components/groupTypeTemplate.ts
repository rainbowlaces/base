import { template, BaseTemplate, type TemplateResult, html, type MaybeOptionalAsync } from "../../../../src/index.js";
import { type GroupType } from '../../models/groupType.js';

export interface GroupTypeTemplateData {
  groupType: MaybeOptionalAsync<GroupType>;
}

async function resolve<T>(promiseOrValue: MaybeOptionalAsync<T>): Promise<T | undefined> {
  if (!promiseOrValue) return undefined;
  return await promiseOrValue;
}

async function resolveProperty<T,K>(data: MaybeOptionalAsync<T>, property: keyof T): Promise<K | undefined> {
  const resolvedData = await resolve(data);
  if (!resolvedData) return undefined;
  return resolvedData[property] as K;
}

@template()
export class GroupTypeTemplate extends BaseTemplate<GroupTypeTemplateData> {
  public render(): TemplateResult {
    return html`
        ${this.tags.if(this.data.groupType !== undefined, {
          then: html`
            <span class="group-type">
                ${resolveProperty<GroupType, string>(this.data.groupType, 'name') || 'No Type'}
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
