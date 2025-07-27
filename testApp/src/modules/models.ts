
import { User } from '../models/user.js';
import { GroupType } from '../models/groupType.js';
import { Group } from '../models/group.js';
import { Article } from '../models/article.js';
import { Comment } from '../models/comment.js';
import { MemoryModel } from '../data/memoryModel.js';
import { type BaseHttpActionArgs, baseModule, BaseModule, request } from '../../../src/index.js';

@baseModule()
export class ModelsModule extends BaseModule {

    /**
     * Seeds the in-memory database with initial data when the application starts.
     */
    async setup() {
        this.logger.info('--- Seeding In-Memory Database ---');

        // Clear all stores for a clean run
        MemoryModel.clearStore();

        // Create and save sample users
        const alice = await User.create({ name: 'Alice', email: 'alice@example.com' });
        await alice.save();
        this.logger.info(`Alice saved with ID: ${alice.id.toString()}`);

        const bob = await User.create({ name: 'Bob', email: 'bob@example.com' });
        await bob.save();
        this.logger.info(`Bob saved with ID: ${bob.id.toString()}`);

        const charlie = await User.create({ name: 'Charlie', email: 'charlie@example.com', active: false });
        await charlie.save();
        this.logger.info(`Charlie saved with ID: ${charlie.id.toString()}`);

        // Create and save group types
        const workGroupType = await GroupType.create({ name: 'Work Team' });
        await workGroupType.save();

        const socialGroupType = await GroupType.create({ name: 'Social Group' });
        await socialGroupType.save();

        // Create and save groups with references
        const devTeam = await Group.create({ name: 'Development Team' });
        await devTeam.type(workGroupType);
        await devTeam.members([alice, bob]);
        await devTeam.save();  

        // Create articles with embedded comments
        const article1 = await Article.create({ title: 'Getting Started with Memory Models', content: 'This article explains how to use the memory model implementation...' });
        
        // Create comments for the article
        const comment1 = await Comment.create({ text: 'Great article!', postedAt: new Date() });
        await comment1.author(alice);

        const comment2 = await Comment.create({ text: 'Very helpful, thanks!', postedAt: new Date() });
        await comment2.author(bob);

        await article1.comments([comment1, comment2]);
        await article1.save();

        // Create another article
        const article2 = await Article.create({ title: 'Advanced Query Patterns', content: 'Learn how to write complex queries...' });
        await article2.save();

        // Set some bookmarks
        await alice.bookmarks([article1, article2]);
        await alice.save();

        this.logger.info('--- Seeding Complete ---');
        this.logger.info(`Created users: Alice (${alice.id.toString()}), Bob (${bob.id.toString()}), Charlie (${charlie.id.toString()})`);
        this.logger.info(`Created articles: ${article1.title}, ${article2.title}`);
    }

    /**
     * API endpoint to get a list of all users.
     */
    @request('/get/users')
    async listUsers({ context }: BaseHttpActionArgs) {
        this.logger.info('GET /users - Listing all users');
        
        try {
            // Query all users (predicate always returns true)
            const usersCollection = await User.query(() => true);
            this.logger.info(`Users collection created, getting array...`);
            const users = await usersCollection.toArray();
            this.logger.info(`Found ${users.length} users in store`);
            
            const response = users.map(user => ({
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                active: user.active,
                created: user.created.toISOString()
            }));
            
            await context.res.json(response);
        } catch (error) {
            this.logger.error('Failed to list users:', [error instanceof Error ? error.message : String(error)]);
            context.res.statusCode(500);
            await context.res.json({ error: 'Failed to retrieve users' });
        }
    }

    /**
     * API endpoint to get a single user by their ID.
     */
    @request('/get/users/:id')
    async getUser({ context, id }: BaseHttpActionArgs & { id: string }) {
        this.logger.info(`GET /users/${id} - Getting user by ID`);
        
        try {
            const user = await User.byId(id);
            
            if (!user) {
                context.res.statusCode(404);
                await context.res.json({ error: 'User not found' });
                return;
            }

            const response = {
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                active: user.active,
                created: user.created.toISOString()
            };
            
            await context.res.json(response);
        } catch (error) {
            this.logger.error(`Failed to get user ${id}:`, [error instanceof Error ? error.message : String(error)]);
            context.res.statusCode(500);
            await context.res.json({ error: 'Failed to retrieve user' });
        }
    }

    /**
     * API endpoint to create a new user.
     */
    @request('/post/users')
    async createUser({ context }: BaseHttpActionArgs) {
        this.logger.info('POST /users - Creating new user');
        
        try {
            const body = await context.req.json<{ name: string; email: string }>();
            
            const newUser = await User.create({ name: body.name, email: body.email });
            await newUser.save();

            context.res.statusCode(201);
            await context.res.json({
                message: 'User created successfully',
                user: {
                    id: newUser.id.toString(),
                    name: newUser.name,
                    email: newUser.email
                }
            });
        } catch (error) {
            this.logger.error('Failed to create user:', [error instanceof Error ? error.message : String(error)]);
            context.res.statusCode(400);
            await context.res.json({ error: 'Failed to create user' });
        }
    }

    /**
     * API endpoint to get articles
     */
    @request('/get/articles')
    async listArticles({ context }: BaseHttpActionArgs) {
        this.logger.info('GET /articles - Listing all articles');
        
        try {
            const articlesCollection = await Article.query(() => true);
            const articles = await articlesCollection.toArray();
            
            const response = await Promise.all(articles.map(async article => {
                const commentsCollection = await article.comments();
                const comments = await commentsCollection.toArray();
                
                const commentsData = await Promise.all(comments.map(async comment => {
                    const author = await comment.author();
                    return {
                        text: comment.text,
                        postedAt: comment.postedAt.toISOString(),
                        author: author ? {
                            id: author.id.toString(),
                            name: author.name
                        } : null
                    };
                }));

                return {
                    id: article.id.toString(),
                    title: article.title,
                    content: article.content,
                    comments: commentsData
                };
            }));
            
            await context.res.json(response);
        } catch (error) {
            this.logger.error('Failed to list articles:', [error instanceof Error ? error.message : String(error)]);
            context.res.statusCode(500);
            await context.res.json({ error: 'Failed to retrieve articles' });
        }
    }

    /**
     * API endpoint to search users by name
     */
    @request('/get/users/search/:name')
    async searchUsers({ context, name }: BaseHttpActionArgs & { name: string }) {
        this.logger.info(`GET /users/search/${name} - Searching users`);
        
        try {
            const usersCollection = await User.query((data: Record<string, unknown>) => {
                return !!(data.name && 
                         typeof data.name === 'string' && 
                         data.name.toLowerCase().includes(name.toLowerCase()));
            });
            const users = await usersCollection.toArray();
            
            const response = users.map(user => ({
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                active: user.active
            }));
            
            await context.res.json(response);
        } catch (error) {
            this.logger.error(`Failed to search users:`, [error instanceof Error ? error.message : String(error)]);
            context.res.statusCode(500);
            await context.res.json({ error: 'Failed to search users' });
        }
    }

    /**
     * API endpoint to get groups
     */
    @request('/get/groups')
    async listGroups({ context }: BaseHttpActionArgs) {
        this.logger.info('GET /groups - Listing all groups');
        
        try {
            const groupsCollection = await Group.query(() => true);
            const groups = await groupsCollection.toArray();
            
            const response = await Promise.all(groups.map(async group => {
                const groupType = await group.type();
                const membersCollection = await group.members();
                const members = await membersCollection.toArray();
                
                return {
                    id: group.id.toString(),
                    name: group.name,
                    type: groupType ? {
                        id: groupType.id.toString(),
                        name: groupType.name
                    } : null,
                    members: members.map(member => ({
                        id: member.id.toString(),
                        name: member.name,
                        email: member.email
                    }))
                };
            }));
            
            await context.res.json(response);
        } catch (error) {
            this.logger.error('Failed to list groups:', [error instanceof Error ? error.message : String(error)]);
            context.res.statusCode(500);
            await context.res.json({ error: 'Failed to retrieve groups' });
        }
    }

    /**
     * Health check endpoint
     */
    @request({ topic: '/get/health' })
    async healthCheck({ context }: BaseHttpActionArgs) {
        await context.res.json({
            status: 'healthy',
            framework: 'Memory Model Demo',
            timestamp: new Date().toISOString()
        });
    }
}
