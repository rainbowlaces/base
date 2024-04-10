import express from "express";

export default class BaseResponse {
  private headers: Record<string, string> = {};
  private cookies: Record<string, string> = {};
  private statusCode: number = 200;

  constructor(private expressRes: express.Response) {}

  get headersSent(): boolean {
    return this.expressRes.headersSent;
  }

  get expressResponse(): express.Response {
    return this.expressRes;
  }

  header(name: string, value: string) {
    this.headers[name] = value;
  }

  cookie(name: string, value: string) {
    this.cookies[name] = value;
  }

  status(code: number) {
    this.statusCode = code;
  }

  send(content: string | Buffer) {
    this.applyPreparations();
    this.expressRes.send(content);
  }

  sendStatus(code: number, content: string = "") {
    this.status(code);
    this.applyPreparations();
    this.expressRes.send(content);
  }

  redirect(url: string, applyPreparations: boolean = true) {
    if (applyPreparations) this.applyPreparations();
    this.expressRes.redirect(url);
  }

  private applyPreparations() {
    this.expressRes.status(this.statusCode);
    Object.entries(this.headers).forEach(([name, value]) => {
      this.expressRes.setHeader(name, value);
    });
    Object.entries(this.cookies).forEach(([name, value]) => {
      this.expressRes.cookie(name, value, { signed: true });
    });
  }
}
