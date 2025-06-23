import * as http from "http";
import path from "path";
import * as os from "os";

import formidable from "formidable";
import cookie from "cookie";
import signature from "cookie-signature";

import { di } from "../../decorators/di";
import { BaseLogger } from "../logger";
import { BaseConfig } from "../config";
import { BaseError } from "../baseErrors";

export interface ParsedForm<T> {
  fields: T;
  files: formidable.Files;
}

export class BaseRequest {
  private _req!: http.IncomingMessage;
  private _method: string;
  private _headers: NodeJS.Dict<string[]>;
  private _url: URL;
  private _ctxId: string;

  @di("BaseLogger", "base_request")
  private accessor _logger!: BaseLogger;

  @di("BaseConfig", "request_handler")
  private accessor _config!: BaseConfig;

  constructor(ctxId: string, req: http.IncomingMessage) {
    this._ctxId = ctxId;
    this._req = req;
    this._method = (req.method || "").toLowerCase();
    if (!http.METHODS.includes(this._method.toUpperCase())) {
      this._logger.error(
        `Invalid HTTP method: ${this._method}`,
        [this._ctxId],
        { req },
      );
      throw new BaseError(`Invalid HTTP method: ${this._method}`);
    }
    this._headers = req.headersDistinct;
    this._url = new URL(req.url || "", `http://${req.headers.host}`);
  }

  get url(): URL {
    return this._url;
  }

  get headers(): NodeJS.Dict<string[]> {
    return this._headers;
  }

  get rawRequest(): http.IncomingMessage | undefined {
    return this._req;
  }

  get method(): string {
    return this._method;
  }

  get cleanPath(): string {
    return (
      "/" + this.url.pathname.replace(/\/+/g, "/").replace(/(^\/|\/$)/g, "")
    );
  }

  header(name: string): string | undefined {
    return this._headers[name.toLowerCase()]?.[0];
  }

  cookie(name: string): string | undefined {
    const cookies = cookie.parse(this.allHeaders("cookie")?.join(";") || "");
    const raw = cookies[name];
    if (raw && raw.substring(0, 2) === "s:") {
      const secret = this._config.get<string>("cookieSecret", "");
      if (secret) {
        const unsignedValue = signature.unsign(raw.slice(2), secret);
        if (unsignedValue !== false) {
          return unsignedValue;
        }
      }
    }
    return undefined;
  }

  allHeaders(): NodeJS.Dict<string[]>;
  allHeaders(name: string): string[] | undefined;
  allHeaders(name?: string): NodeJS.Dict<string[]> | string[] | undefined {
    if (!name) {
      return this._headers;
    }
    return this._headers[name.toLowerCase()];
  }

  async rawBody(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalLength = 0;
      let bodyTooLarge = false;

      this._req.on("data", (chunk) => {
        totalLength += chunk.length;
        if (totalLength > this._config.get<number>("maxBodySize", 5e6)) {
          this._req.destroy();
          bodyTooLarge = true;
          reject(new BaseError("Request body too large"));
          return;
        }
        chunks.push(chunk);
      });

      this._req.on("end", () => {
        if (!bodyTooLarge) {
          resolve(Buffer.concat(chunks));
        }
      });

      this._req.on("error", (err) => {
        this._logger.error(
          "Error occurred during body parsing",
          [this._ctxId],
          { err },
        );
        reject(
          new BaseError("Error occurred during body parsing", err as Error),
        );
      });
    });
  }

  async text(): Promise<string> {
    try {
      const body = await this.rawBody();
      return body.toString("utf-8");
    } catch (err) {
      this._logger.error("Error parsing text body.", [this._ctxId], { err });
      throw new BaseError("Error parsing text body.", err as Error);
    }
  }

  async json<T>(): Promise<T> {
    try {
      const body = await this.text();
      return JSON.parse(body) as T;
    } catch (err) {
      this._logger.error("Error parsing JSON body.", [this._ctxId], { err });
      throw new BaseError("Error parsing JSON body.", err as Error);
    }
  }

  async form<T>(): Promise<ParsedForm<T>> {
    const form = formidable({
      encoding: this._config.get<formidable.BufferEncoding>(
        "formEncoding",
        "utf-8" as formidable.BufferEncoding,
      ),
      uploadDir: this._config.get<string>(
        "uploadDir",
        path.resolve(path.join(os.tmpdir(), "uploads")),
      ),
      keepExtensions: this._config.get<boolean>("keepExtensions", true),
      maxFileSize: this._config.get<number>("maxUploadSize", 5e6),
      maxFields: this._config.get<number>("maxFormFields", 1000),
    });
    let fields: formidable.Fields;
    let files: formidable.Files;

    try {
      [fields, files] = await form.parse(this._req);
    } catch (err) {
      this._logger.error("Error parsing form data", [this._ctxId], { err });
      throw new BaseError("Error parsing form data", err as Error);
    }

    return {
      fields: fields as unknown as T,
      files,
    };
  }
}
