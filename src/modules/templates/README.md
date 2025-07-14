# `BaseTemplates`: A Component-Based Rendering Engine

So, you've got your data nicely structured in models and accessible via request handlers. Now comes the tedious part: turning that data into HTML. The **`BaseTemplates`** module provides a structured, component-based system for rendering server-side HTML.

It borrows the best ideas from modern UI libraries—like reusable components and a declarative syntax—but keeps things firmly on the server. The goal is to build complex pages by composing smaller, type-safe, and self-contained pieces, rather than wrestling with giant, monolithic template files full of spaghetti code.

-----

## Core Concepts

The entire system is built around a few key ideas. Understanding them is crucial to using the engine effectively.

###  1. The `html` Tagged Template

Everything starts with the `html` tagged template literal. It looks simple, but it's not just string concatenation.

```typescript
import { html } from './engine/html.js';

const myTemplate = html`<h1>Hello, ${userName}</h1>`;
```

When you use it, the engine intelligently separates the static parts (the raw HTML strings like ` <h1>Hello,  `) from the dynamic values (`${userName}`).

  * **Static parts** are treated as raw, trusted HTML.
  * **Dynamic values** are, by default, rigorously **sanitized** to prevent XSS attacks. The only way to output raw, unescaped dynamic content is to explicitly wrap it in the `unsafe` tag, making security the default and danger the exception.

###  2. Composable Components (`@template`)

A **Template Component** is a reusable piece of UI, much like a React or Vue component. You create one by defining a class that extends `BaseTemplate` and decorating it with **`@template`**.

  * It's a class that receives a well-defined `data` object in its constructor.
  * It has a `render()` method that returns a `TemplateResult` (the output of the `html` function).
  * Crucially, a component can render other components. This allows you to build a complex page layout (e.g., `CorePageTemplate`) out of smaller, manageable pieces (e.g., `HeaderTemplate`, `FooterTemplate`).

###  3. Logic with Tags (`@tag`)

For conditional logic and loops directly within your templates, you use **Tags**. These are special helper functions available inside any `BaseTemplate` via the `this.tags` property.

The core framework provides a few essential tags out of the box:

  * **`each`**: For iterating over arrays, collections, or even asynchronous iterables.
  * **`if`**: For simple conditional rendering.
  * **`unsafe`**: The aforementioned escape hatch for rendering unsanitized HTML. Use it with extreme caution.

These tags are themselves components, registered with the DI container via the **`@tag`** decorator.

###  4. Asynchronous Rendering 🚀

This is a cornerstone of the engine's design. Nearly every part of the system is `async`-aware. You can pass promises or even `BaseModelCollection` instances directly into your templates. The `each` tag, for example, can iterate directly over a database collection without you needing to `await` and convert it to an array in your controller. The engine handles resolving all the promises and streams during the final render phase.

###  5. Type Safety with Declaration Merging

To achieve full type safety and autocompletion, the system relies on TypeScript's **declaration merging**. When you create a new template or tag, you also declare its "shape" in the global `Templates` or `TemplateTags` interface.

This registers your component with the type system, so when you write `this.templates.MyComponent(...)`, TypeScript knows exactly what data `MyComponent` expects and will throw an error if you get it wrong.

-----

## How It All Works: The Rendering Flow

Let's trace the process from a request handler to a fully rendered HTML page, using the provided test application as an example.

1.  **Request Hits**: A request comes in to `GET /dashboard/users`, which is handled by the `users` action in `DashboardModule`.

2.  **Data Fetching**: The `users` action queries the database: `const usersCollection = await User.query(...)`. Note that it gets back a `MemoryModelCollection`, which is an async iterable.

3.  **Initiate Render**: The action calls the master render method on the `BaseTemplates` service, passing the component class and the data:

    ```typescript
    context.res.html(this.templates.render(UserListTemplate, { users: usersCollection }));
    ```

4.  **Component Rendering**:

      * The `BaseTemplates` service creates an instance of `UserListTemplate`, passing the `usersCollection` to its constructor.
      * The `UserListTemplate`'s `render()` method is called. It doesn't contain the `<html>` or `<body>` tags itself. Instead, it **composes** the `CorePageTemplate`, passing its own content down as a parameter.
      * `render()` calls `this.templates.CorePageTemplate({ title: "Users", content: ... })`.

5.  **Logic Execution**:

      * Inside the `content` for the page, it uses the `each` tag to iterate over the data: `this.tags.each(this.data.users, { do: (user) => ... })`.
      * The `each` tag is smart enough to handle the `BaseModelCollection` asynchronously. It iterates through the collection, yielding one `User` model at a time.
      * For each user, it generates a `<tr>` with the user's data.

6.  **Final Assembly**: The `TemplateResult` objects from all components and tags are recursively resolved. All promises are awaited, all async iterators are consumed, and all dynamic values are sanitized. The final result is a single, complete HTML string, which is then sent back in the HTTP response.

-----

## Practical Examples

### Creating a Reusable Component

Here’s how to create a simple, reusable `WelcomeMessage` component.

**Step 1: Define the template class**

It extends `BaseTemplate` and defines the data it needs (`WelcomeData`).

```typescript
// src/templates/components/welcomeMessage.ts
import { template, BaseTemplate, type TemplateResult, html } from "../../../src/index.js";

export interface WelcomeData {
    userName: string;
    notificationCount: number;
}

@template()
export class WelcomeMessage extends BaseTemplate<WelcomeData> {
    public render(): TemplateResult {
        return html`
            <div class="welcome">
                <h2>Welcome back, ${this.data.userName}!</h2>
                ${this.tags.if(this.data.notificationCount > 0, {
                    then: html`<p>You have ${this.data.notificationCount} new messages.</p>`,
                    else: html`<p>Your inbox is empty.</p>`
                })}
            </div>
        `;
    }
}
```

**Step 2: Register the type via declaration merging**

This gives you type-safe autocompletion everywhere.

```typescript
// Add this to the end of the file or in a central types file
declare module "../../../src/index.js" {
    interface Templates {
        WelcomeMessage: WelcomeMessage;
    }
}
```

### Using and Composing Components

Now, you can use that component inside a larger page template. Notice how the `CorePageTemplate` calls `this.templates.WelcomeMessage`.

```typescript
// src/templates/myPage.ts
import { template, BaseTemplate, type TemplateResult, html } from "../../../src/index.js";
import { type WelcomeData } from './components/welcomeMessage.js';

// Data for the main page, which includes the data for the welcome message
export interface MyPageData {
    welcomeInfo: WelcomeData;
}

@template()
export class MyPage extends BaseTemplate<MyPageData> {
    public render(): TemplateResult {
        return this.templates.CorePageTemplate({
            title: "My Page",
            headerData: { title: "User Dashboard" },
            content: html`
                <h1>Main Content</h1>
                <p>Here is the main content of the page.</p>

                ${this.templates.WelcomeMessage(this.data.welcomeInfo)}
            `,
            footerData: {}
        });
    }
}
```

-----

## Key Components

| Component | File(s) | Role |
| :--- | :--- | :--- |
| **`BaseTemplates`** | `baseTemplates.ts` | The central DI service that manages and renders all templates and tags. |
| **`BaseTemplate<T>`** | `baseTemplate.ts` | The abstract class that all template components must extend. It receives typed `data` and provides access to `this.tags` and `this.templates`. |
| **`@template`** | `decorators/template.ts` | A class decorator that registers a template component with the DI container, making it available for rendering. |
| **`@tag`** | `decorators/tag.ts` | A class decorator that registers a logic tag (like `if` or `each`) with the DI container. |
| **`html`** | `engine/html.ts` | The tagged template literal function that is the foundation of the entire engine. It produces a `TemplateResult`. |
| **`TemplateResult`** | `engine/templateResult.ts` | The object returned by the `html` function, which contains the structured representation of the template before it's rendered to a string. |
| **`Renderable`** | `engine/renderable.ts` | The abstract base class for any object that can be rendered to a string. It handles the default-on sanitization logic. |
| **`Tag`** | `engine/tag.ts` | The abstract base class for all logic tags. |