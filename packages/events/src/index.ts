import Redis from "ioredis";

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  type: string;
  projectId?: string;
  organizationId?: string;
  occurredAt: string;
  data: T;
}

export function createRedis(url = process.env.REDIS_URL ?? "redis://localhost:6379"): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

export class EventBus {
  constructor(
    private readonly redis: Redis,
    private readonly channel = "cpaas.events"
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    await this.redis.publish(this.channel, JSON.stringify(event));
  }

  async subscribe(handler: (event: DomainEvent) => void | Promise<void>): Promise<void> {
    const sub = this.redis.duplicate();
    await sub.subscribe(this.channel);
    sub.on("message", (_ch, message) => {
      void Promise.resolve(handler(JSON.parse(message) as DomainEvent));
    });
  }
}

export function newEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
