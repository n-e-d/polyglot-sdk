import https from "https";
import { Readable } from "stream";
import { PolyglotError, RetryableError } from "./error-handler";

interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export class HttpClient {
  static async post(
    url: string,
    data: Record<string, any>,
    headers: Record<string, string>
  ): Promise<any> {
    try {
      const response = await this.makeRequest("POST", url, data, headers);
      return JSON.parse(response.body);
    } catch (error) {
      this.handleError(error);
    }
  }

  static postStream(
    url: string,
    data: Record<string, any>,
    headers: Record<string, string>
  ): Readable {
    const stream = new Readable({
      read() {},
    });

    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      },
      (res) => {
        res.on("data", (chunk) => stream.push(chunk));
        res.on("end", () => stream.push(null));
      }
    );

    req.on("error", (error) => {
      stream.emit("error", this.handleError(error));
    });

    req.write(JSON.stringify(data));
    req.end();

    return stream;
  }

  private static makeRequest(
    method: string,
    url: string,
    data: Record<string, any>,
    headers: Record<string, string>
  ): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        url,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk.toString()));
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode || 500,
              headers: res.headers as Record<string, string>,
              body,
            });
          });
        }
      );

      req.on("error", reject);
      req.write(JSON.stringify(data));
      req.end();
    });
  }

  private static handleError(error: any): never {
    if (error instanceof Error) {
      if (error.message.includes("429")) {
        throw new RetryableError("Rate limit exceeded");
      }
      if (error.message.includes("500")) {
        throw new RetryableError("Server error");
      }
    }
    throw new PolyglotError(`HTTP request failed: ${error.message}`);
  }
}
