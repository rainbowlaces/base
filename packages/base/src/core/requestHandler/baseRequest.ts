import * as http from "http";

import formidable from "formidable";
import cookie from "cookie";
import signature from "cookie-signature";

import { registerDi } from "../../core/di/decorators/registerDi.js";
import { di } from "../../core/di/decorators/di.js";
import { type BaseLogger } from "../../core/logger/baseLogger.js";
import { BaseError } from "../../core/baseErrors.js";
import { type ParsedForm, type BaseRequestHandlerConfig } from "./types.js";
import { config } from "../config/decorators/config.js";

@registerDi()
export class BaseRequest {
  #req!: http.IncomingMessage;
  #method: string;
  #headers: NodeJS.Dict<string[]>;
  #url: URL;
  #ctxId: string;

  @di("BaseLogger", "BaseRequest")
  private accessor logger!: BaseLogger;

  @config<BaseRequestHandlerConfig>("BaseRequestHandler")
  private accessor config!: BaseRequestHandlerConfig;

  constructor(ctxId: string, req: http.IncomingMessage) {
    this.#ctxId = ctxId;
    this.#req = req;
    this.#method = (req.method ?? "").toLowerCase();
    if (!http.METHODS.includes(this.#method.toUpperCase())) {
      this.logger.error(
        `Invalid HTTP method: ${this.#method}`,
        [this.#ctxId],
        { req },
      );
      throw new BaseError(`Invalid HTTP method: ${this.#method}`);
    }
    this.#headers = req.headersDistinct;
    this.#url = new URL(req.url ?? "", `http://${req.headers.host}`);
  }

  get url(): URL {
    return this.#url;
  }

  get headers(): NodeJS.Dict<string[]> {
    return this.#headers;
  }

  get rawRequest(): http.IncomingMessage | undefined {
    return this.#req;
  }

  get method(): string {
    return this.#method;
  }

  get cleanPath(): string {
    return (
      "/" + this.url.pathname.replace(/\/+/g, "/").replace(/(^\/|\/$)/g, "")
    );
  }

  header(name: string): string | undefined {
    return this.#headers[name.toLowerCase()]?.[0];
  }

  cookie(name: string): string | undefined {
    const cookies = cookie.parse(this.allHeaders("cookie")?.join(";") ?? "");
    const raw = cookies[name];
    if (raw?.startsWith("s:")) {
      const secret = this.config.cookieSecret;
      if (secret.length > 0) {
        const unsignedValue = signature.unsign(raw.slice(2), secret);
        if (unsignedValue !== false) {
          return unsignedValue;
        }
      }
    }
    return raw;
  }

  allHeaders(): NodeJS.Dict<string[]>;
  allHeaders(name: string): string[] | undefined;
  allHeaders(name?: string): NodeJS.Dict<string[]> | string[] | undefined {
    if (!name) {
      return this.#headers;
    }
    return this.#headers[name.toLowerCase()];
  }

  async rawBody(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalLength = 0;
      let bodyTooLarge = false;

      this.#req.on("data", (chunk: Buffer) => {
        totalLength += chunk.length;
        if (totalLength > this.config.maxBodySize) {
          this.#req.destroy();
          bodyTooLarge = true;
          reject(new BaseError("Request body too large"));
          return;
        }
        chunks.push(chunk);
      });

      this.#req.on("end", () => {
        if (!bodyTooLarge) {
          resolve(Buffer.concat(chunks));
        }
      });

      this.#req.on("error", (err) => {
        this.logger.error(
          "Error occurred during body parsing",
          [this.#ctxId],
          { err },
        );
        reject(
          new BaseError("Error occurred during body parsing", err),
        );
      });
    });
  }

  async text(): Promise<string> {
    try {
      const body = await this.rawBody();
      return body.toString("utf-8");
    } catch (err) {
      this.logger.error("Error parsing text body.", [this.#ctxId], { err });
      throw new BaseError("Error parsing text body.", err as Error);
    }
  }

  async json<T>(): Promise<T> {
    try {
      const body = await this.text();
      return JSON.parse(body) as T;
    } catch (err) {
      this.logger.error("Error parsing JSON body.", [this.#ctxId], { err });
      throw new BaseError("Error parsing JSON body.", err as Error);
    }
  }

  async form<T>(): Promise<ParsedForm<T>> {
    const form = formidable({
      encoding: this.config.formEncoding,
      uploadDir: this.config.uploadDir,
      keepExtensions: this.config.keepExtensions,
      maxFileSize: this.config.maxUploadSize,
      maxFields: this.config.maxFields,
    });
    let fields: formidable.Fields;
    let files: formidable.Files;

    try {
      [fields, files] = await form.parse(this.#req);
    } catch (err) {
      this.logger.error("Error parsing form data", [this.#ctxId], { err });
      throw new BaseError("Error parsing form data", err as Error);
    }

    return {
      fields: fields as unknown as T,
      files,
    };
  }
}
