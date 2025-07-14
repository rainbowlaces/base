import {
  template,
  BaseTemplate,
  type TemplateResult,
  html,
  type BaseModelCollection,
  type MaybeAsync,
} from "../../../src/index.js";
import { type Article } from "../models/article.js";

export interface ArticleListTemplateData {
  articles: MaybeAsync<BaseModelCollection<Article>>;
}

@template()
export class ArticleListTemplate extends BaseTemplate<ArticleListTemplateData> {
  public render(): TemplateResult {
    return this.templates.CorePageTemplate({
      title: "Articles",
      headerData: {
        title: "Article Management",
        currentPage: "articles",
      },
      content: html`
        ${this.tags.each(this.data.articles, {
          do: (item: unknown) => {
            const article = item as Article;
            return html`
              <div class="article">
                <div class="article-header">
                  <h2 class="article-title">${article.title}</h2>
                </div>
                <div class="article-content">${article.content}</div>
                <article-comments article-id="${article.id}"></article-comments>
              </div>
            `;
          },
        })}
      `,
      footerData: {
        text: "🚀 Article Management - Powered by Component Templates",
      },
    });
  }
}

declare module "../../../src/index.js" {
  interface Templates {
    ArticleListTemplate: ArticleListTemplate;
  }
}
