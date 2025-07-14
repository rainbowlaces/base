import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

interface CommentData {
  text: string;
  postedAt: string;
  author: {
    id: string;
    name: string;
  } | null;
}

interface ArticleData {
  id: string;
  title: string;
  content: string;
  comments: CommentData[];
}

@customElement("article-comments")
export class ArticleCommentsElement extends LitElement {
  @property({ type: String, attribute: "article-id" })
  accessor articleId: string = "";

  @state()
  private accessor comments: CommentData[] = [];

  @state()
  private accessor loading: boolean = false;

  @state()
  private accessor error: string = "";

  static styles = css`
    :host {
      display: block;
      background: #f8f9fa;
      border-top: 1px solid #e9ecef;
    }

    .comments-section {
      background: #f8f9fa;
    }

    .comments-header {
      padding: 15px 20px;
      font-weight: 600;
      color: #2c3e50;
      border-bottom: 1px solid #e9ecef;
    }

    .comments-list {
      padding: 0;
    }

    .comment {
      padding: 15px 20px;
      border-bottom: 1px solid #e9ecef;
      background: white;
      margin: 0;
    }

    .comment:last-child {
      border-bottom: none;
    }

    .comment-author {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .comment-text {
      color: #495057;
      line-height: 1.5;
      margin-bottom: 8px;
    }

    .comment-date {
      color: #6c757d;
      font-size: 12px;
      font-style: italic;
    }

    .loading {
      padding: 20px;
      text-align: center;
      color: #6c757d;
    }

    .error {
      padding: 20px;
      color: #dc3545;
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      margin: 10px 20px;
    }

    .no-comments {
      padding: 20px;
      text-align: center;
      color: #6c757d;
      font-style: italic;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.loadComments();
  }

  private async loadComments() {
    console.log(`Loading comments for article ID: ${this.articleId}`);

    if (!this.articleId) {
      this.comments = [];
      return;
    }

    this.loading = true;
    this.error = "";

    try {
      const response = await fetch(`/api/articles/${this.articleId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          this.error = `Article with ID ${this.articleId} not found`;
        } else {
          this.error = `Failed to load article: ${response.status} ${response.statusText}`;
        }
        return;
      }

      const articleData = await response.json() as ArticleData;
      this.comments = articleData.comments;
    } catch (err) {
      this.error = `Failed to load comments: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.loading = false;
    }
  }

  render() {
    if (this.loading) {
      return html`
        <div class="comments-section">
          <div class="loading">Loading comments...</div>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="comments-section">
          <div class="error">${this.error}</div>
        </div>
      `;
    }

    return html`
      <div class="comments-section">
        <div class="comments-header">
          Comments (${this.comments.length})
        </div>
        <div class="comments-list">
          ${this.comments.length === 0 
            ? html`<div class="no-comments">No comments yet.</div>`
            : this.comments.map(comment => html`
                <div class="comment">
                  <div class="comment-author">
                    ${this.renderAuthor(comment)}
                  </div>
                  <div class="comment-text">
                    ${comment.text}
                  </div>
                  <div class="comment-date">
                    ${new Date(comment.postedAt).toLocaleDateString()} at ${new Date(comment.postedAt).toLocaleTimeString()}
                  </div>
                </div>
              `)
          }
        </div>
      </div>
    `;
  }

  private renderAuthor(comment: CommentData) {
    return comment.author ? comment.author.name : "Anonymous";
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "article-comments": ArticleCommentsElement;
  }
}
