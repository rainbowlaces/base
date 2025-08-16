import { User } from '../models/user.js';
import { Article } from '../models/article.js';
import { Group } from '../models/group.js';
import { type BaseHttpActionArgs, baseModule, BaseModule, di, request, type BaseTemplates } from '../../../src/index.js';
import { DashboardTemplate, type DashboardTemplateData } from '../templates/dashboardTemplate.js';
import { UserListTemplate, type UserListTemplateData } from '../templates/userListTemplate.js';
import { ArticleListTemplate, type ArticleListTemplateData } from '../templates/articleListTemplate.js';
import { GroupListTemplate } from '../templates/groupListTemplate.js';

declare module '../../../src/index.js' {
    interface HttpContextData {
        time?: string; // Add time to context for demonstration
    }
}

// Also declare for the direct import path
declare module '../../../src/core/requestHandler/types.js' {
    interface HttpContextData {
        time?: string;
    }
}

@baseModule()
export class DashboardModule extends BaseModule {

    @di<BaseTemplates>("BaseTemplates")
    private accessor templates!: BaseTemplates;


    @request()
    async setTimeToContext({ context }: BaseHttpActionArgs) {
        context.data.time = new Date().toISOString();
    }
    /**
     * Dashboard homepage - shows overview of all data
     */
    @request('/get/dashboard')
    async getDashboard({ context }: BaseHttpActionArgs) {
        this.logger.info('GET /dashboard - Rendering dashboard');
        
        try {
            // Get summary data from all models
            const usersCollection = await User.query(() => true);
            const users = await usersCollection.toArray();
            
            const articlesCollection = await Article.query(() => true);
            const articles = await articlesCollection.toArray();
            
            const groupsCollection = await Group.query(() => true);
            const groups = await groupsCollection.toArray();

            // Count total comments across all articles
            let totalComments = 0;
            for (const article of articles) {
                const commentsCollection = await article.comments();
                const comments = await commentsCollection.toArray();
                totalComments += comments.length;
            }

            const dashboardData: DashboardTemplateData = {
                title: 'RL-Base Memory Model Demo',
                time: context.data.time ?? "No time set",
                stats: {
                    totalModules: 3, // Users, Articles, Groups
                    totalEndpoints: users.length + articles.length + groups.length,
                    uptime: '0d 0h 1m' // Just a placeholder
                },
                modules: [
                    {
                        name: 'Users',
                        description: 'Manage user accounts with email and activity status',
                        endpoints: [
                            '/dashboard/users - View all users',
                            `/get/users - API (${users.length} users)`
                        ]
                    },
                    {
                        name: 'Articles',
                        description: 'Browse articles with embedded comments and bookmarks',
                        endpoints: [
                            '/dashboard/articles - View all articles',
                            `/get/articles - API (${articles.length} articles, ${totalComments} comments)`
                        ]
                    },
                    {
                        name: 'Groups',
                        description: 'View groups with types and member relationships',
                        endpoints: [
                            '/dashboard/groups - View all groups',
                            `/get/groups - API (${groups.length} groups)`
                        ]
                    }
                ]
            };

            void context.res.html(this.templates.render(DashboardTemplate, dashboardData));
        } catch (error) {
            this.logger.error('Failed to render dashboard:', [error instanceof Error ? error.message : String(error)]);
            context.res.statusCode(500);
            await context.res.send('Internal Server Error');
        }
    }

    /**
     * Users page - shows detailed user list
     */
    @request('/get/dashboard/users')
    async users({ context }: BaseHttpActionArgs) {
        this.logger.info('GET /dashboard/users - Rendering users list');
        
        try {
            const usersCollection = await User.query(() => true);
            // Pass the collection directly instead of converting to array and mapping to plain objects
            
            const userData: UserListTemplateData = {
                users: usersCollection
            };
            await context.res.html(this.templates.render(UserListTemplate, userData));
        } catch (error) {
            this.logger.error('Failed to render users page:', [error instanceof Error ? error.message : String(error)]);
            context.res.statusCode(500);
            await context.res.send('Internal Server Error');
        }
    }

    /**
     * Articles page - shows articles with comments
     */
    @request('/get/dashboard/articles')
    async articles({ context }: BaseHttpActionArgs) {
        this.logger.info('GET /dashboard/articles - Rendering articles list');
        
        try {
            const articlesCollection = await Article.query(() => true);
            // Pass the collection directly instead of converting to array and resolving relationships
            
            const templateData: ArticleListTemplateData = {
                articles: articlesCollection
            };

            void context.res.html(this.templates.render(ArticleListTemplate, templateData));
        } catch (error) {
            this.logger.error('Failed to render articles page:', [error instanceof Error ? error.message : String(error)]);
            context.res.statusCode(500);
            await context.res.send('Internal Server Error');
        }
    }

    /**
     * Groups page - shows groups with members
     */
    @request('/get/dashboard/groups')
    async groups({ context }: BaseHttpActionArgs) {
        this.logger.info('GET /dashboard/groups - Rendering groups list');
        
        try {
            void context.res.html(this.templates.render(GroupListTemplate, { groups: Group.query(() => true)}));
        } catch (error) {
            this.logger.error('Failed to render groups page:', [error instanceof Error ? error.message : String(error)]);
            context.res.statusCode(500);
            await context.res.send('Internal Server Error');
        }
    }

    /**
     * API endpoint to fetch article with comments for client-side components
     */
    @request('/get/api/articles/:id')
    async getArticleWithComments({ context, id }: BaseHttpActionArgs & { id: string }) {
        this.logger.info(`GET /api/articles/${id} - Fetching article with comments`);
        
        try {
            const article = await Article.byId(id);
            if (!article) {
                context.res.statusCode(404);
                await context.res.json({ error: 'Article not found' });
                return;
            }

            // Get comments
            const commentsCollection = await article.comments();
            const comments = await commentsCollection.toArray();

            // Convert comments to plain objects with author info
            const commentsData = await Promise.all(comments.map(async (comment) => {
                const authorRef = await comment.author();
                return {
                    text: comment.text,
                    postedAt: comment.postedAt.toISOString(),
                    author: authorRef ? {
                        id: authorRef.id.toString(),
                        name: authorRef.name
                    } : null
                };
            }));

            const articleData = {
                id: article.id.toString(),
                title: article.title,
                content: article.content,
                comments: commentsData
            };

            await context.res.json(articleData);
        } catch (error) {
            this.logger.error('Failed to fetch article:', [error instanceof Error ? error.message : String(error)]);
            context.res.statusCode(500);
            await context.res.json({ error: 'Internal server error' });
        }
    }
}
