import https from "https";
import { Readable } from "stream";
import {
  PolyglotError,
  NetworkError,
  RateLimitError,
  logger,
} from "./error-handler";
import { IncomingMessage } from "http";

interface Response {
  statusCode: number;
  headers: IncomingMessage["headers"];
  body: string;
}

export class HttpClient {
  static async post(
    url: string,
    data: Record<string, any>,
    headers: Record<string, string>
  ): Promise<any> {
    try {
      logger.info(`Sending POST request to ${url}`);
      const response = await this.makeRequest("POST", url, data, headers);
      logger.info(`Received response from ${url}`, {
        statusCode: response.statusCode,
      });
      return JSON.parse(response.body);
    } catch (error) {
      return this.handleRequestError(error);
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

    logger.info(`Initiating streaming POST request to ${url}`);

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
        res.on("end", () => {
          logger.info(`Streaming request to ${url} completed`);
          stream.push(null);
        });
      }
    );

    req.on("error", (error) => {
      logger.error(`Error in streaming request to ${url}`, { error });
      stream.emit("error", this.handleRequestError(error));
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
  ): Promise<Response> {
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
              headers: res.headers,
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

  private static handleRequestError(error: any): never {
    logger.error("HTTP request error", { error });
    if (error.response) {
      if (error.response.status === 429) {
        throw new RateLimitError(
          "Rate limit exceeded",
          error.response.headers["retry-after"]
        );
      }
      if (error.response.status >= 500) {
        throw new NetworkError("Server error", error.response.status);
      }
    }
    throw new PolyglotError(
      `HTTP request failed: ${error.message}`,
      "HTTP_ERROR"
    );
  }
}
