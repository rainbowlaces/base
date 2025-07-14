# `BaseStatic`: Static File Server

Even the most complex web application needs to serve the basics: stylesheets, JavaScript bundles, images, fonts, and the occasional `favicon.ico` that browsers will incessantly demand. The **`BaseStatic`** module handles this mundane but essential task.

It's a built-in `BaseModule` that automatically handles requests for static assets, serving them from a designated folder with proper caching headers and, most importantly, security checks to prevent users from poking around your filesystem where they don't belong.

-----

## Core Features

While its job is simple, it does it properly.

### Automatic Route Handling

The module comes pre-configured with a request handler that listens for any `GET` request matching the pattern `/static/:path*`. This means any request to `/static/css/main.css` or `/static/images/logo.png` will be automatically intercepted and handled by this module without any additional configuration.

###  Directory Traversal Protection

This is the most critical feature. The module will **only** serve files from within its configured root directory (e.g., `/public`). If a request tries to use path traversal to escape this directory (e.g., `/static/../../../etc/passwd`), the request will be immediately denied with a `403 Forbidden` error. This prevents clients from reading sensitive files on your server.

###  Built-in HTTP Caching

To ensure your application is performant and doesn't waste bandwidth re-sending the same assets, the module implements two standard HTTP caching strategies out of the box:

  * **ETag**: A unique hash is generated from the file's content. On subsequent requests, the browser sends this hash in the `If-None-Match` header. If the file hasn't changed, the server sends back a lightweight `304 Not Modified` response, telling the browser to use its cached version.
  * **Last-Modified**: The file's last modification date is sent as a `Last-Modified` header. The browser sends this back in the `If-Modified-Since` header, allowing the server to return a `304 Not Modified` response if the file is unchanged.

###  Automatic MIME Types

The module uses the file's extension to automatically set the correct `Content-Type` header (e.g., `text/css`, `application/javascript`). This ensures browsers know how to correctly interpret the files they receive.

-----

## Configuration

You can customize the module's behavior through the application configuration. The `BaseStaticConfig` class exposes the following options:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **`staticFsRoot`** | `string` | `"/public"` | The path to the directory containing your static assets, relative to your application's root. |
| **`maxAge`** | `number` | `3600` | The value for the `Cache-Control: max-age` header, in **seconds**. This tells the browser how long it can cache the file before needing to check with the server again. The default is 1 hour. |

###  Example Configuration

To change these defaults, you provide a `BaseStatic` object in your application's config provider. For example, to serve files from a `/dist` directory and set the cache age to 24 hours:

```typescript
// src/config/default.ts
import { type BaseAppConfig, BaseConfigProvider, provider } from "../../../src/index.js";

@provider()
export class AppConfig extends BaseConfigProvider {
  get config(): Partial<BaseAppConfig> {
    return {
      // ... other configurations
      BaseStatic: {
        staticFsRoot: "/dist",      // Serve files from the project's 'dist' folder
        maxAge: 86400               // Cache for 24 hours (24 * 60 * 60)
      }
    };
  }  
}
```

-----

## How It Works: The Life of a Static File Request

1.  **Request**: A browser, having parsed your HTML, sends a request for `GET /static/css/main.css`.

2.  **Handler Triggered**: The `@request("/get/static/:path*")` decorator on the `handleStatic` method matches the request. The `path` parameter becomes `css/main.css`.

3.  **Path Resolution**: The module combines its configured root directory (e.g., `/path/to/your/app/public`) with the requested path to create an absolute file path: `/path/to/your/app/public/css/main.css`.

4.  **Security Check**: It verifies that this resolved path still starts with `/path/to/your/app/public`. It does, so the request proceeds.

5.  **Caching Check**:

      * The browser may have sent an `If-None-Match` or `If-Modified-Since` header from a previous visit.
      * The module compares these headers against the current file's ETag (a hash of its content) and modification date.
      * If the file is unchanged, the module sends a `304 Not Modified` response and the process ends here. 👏

6.  **File Read**: If it's a new request or the file has changed, the module reads the file from the disk. If the file doesn't exist, it sends a `404 Not Found`.

7.  **Response Headers**: The module sets the following headers on the response:

      * `Content-Type`: `text/css`
      * `Cache-Control`: `public, max-age=3600`
      * `ETag`: `some-sha1-hash-of-the-file-content`
      * `Last-Modified`: `...the file's modification date...`

8.  **Send Payload**: The contents of `main.css` are sent as the response body. The request is complete.