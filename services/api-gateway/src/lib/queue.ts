import net from "node:net";
import { URL } from "node:url";

export interface QueueClient {
  ping(): Promise<void>;
  close?(): Promise<void>;
}

let cachedQueue: QueueClient | null = null;

function resolveRedisUrl(): URL {
  const raw = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  try {
    return new URL(raw);
  } catch (err) {
    throw new Error(`Invalid REDIS_URL provided: ${raw}`);
  }
}

class RedisQueueClient implements QueueClient {
  private readonly url: URL;

  constructor(url: URL) {
    this.url = url;
  }

  async ping(): Promise<void> {
    const port = this.url.port ? Number(this.url.port) : 6379;
    const host = this.url.hostname;

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.write("PING\r\n");
      });

      socket.setTimeout(3000);

      let buffer = "";

      const cleanup = () => {
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        if (buffer.includes("+PONG")) {
          cleanup();
          resolve();
        }
      });

      socket.on("timeout", () => {
        cleanup();
        reject(new Error("Redis ping timed out"));
      });

      socket.on("error", (err) => {
        cleanup();
        reject(err);
      });

      socket.on("end", () => {
        if (!buffer.includes("+PONG")) {
          cleanup();
          reject(new Error("Redis ping did not return PONG"));
        }
      });
    });
  }
}

export async function loadDefaultQueue(): Promise<QueueClient> {
  if (!cachedQueue) {
    cachedQueue = new RedisQueueClient(resolveRedisUrl());
  }
  return cachedQueue;
}

export function setQueueClient(client: QueueClient | null): void {
  cachedQueue = client;
}
