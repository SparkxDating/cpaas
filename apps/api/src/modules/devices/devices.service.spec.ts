import { AppError } from "@cpaas/common";
import { generatePairingCode, hashToken, normalizePairingCode } from "@cpaas/auth";
import { DevicesService } from "./devices.service";

type PrismaMock = {
  device: {
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  devicePairing: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  deviceOutbox: {
    findMany: jest.Mock;
    updateMany: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
};

function mockPrisma(): PrismaMock {
  return {
    device: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    devicePairing: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    deviceOutbox: {
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

describe("DevicesService pairing phase", () => {
  it("registers devices as PENDING until heartbeat", async () => {
    const prisma = mockPrisma();
    prisma.device.create.mockResolvedValue({
      id: "dev_1",
      name: "Pixel",
      status: "PENDING",
      config: { pollIntervalSec: 5 },
    });
    const svc = new DevicesService(prisma as unknown as ConstructorParameters<typeof DevicesService>[0]);
    const result = await svc.register({ projectId: "proj_1", name: "Pixel" });
    expect(result.status).toBe("PENDING");
    expect(result.deviceToken).toMatch(/^dev_/);
    expect(prisma.device.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", projectId: "proj_1" }),
      })
    );
  });

  it("heartbeat promotes PENDING to ONLINE", async () => {
    const prisma = mockPrisma();
    prisma.device.findUnique.mockResolvedValue({
      id: "dev_1",
      status: "PENDING",
    });
    prisma.device.update.mockResolvedValue({
      id: "dev_1",
      status: "ONLINE",
      config: {},
    });
    const svc = new DevicesService(prisma as unknown as ConstructorParameters<typeof DevicesService>[0]);
    const result = await svc.heartbeat("dev_1", { batteryPercent: 80 });
    expect(result.status).toBe("ONLINE");
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ONLINE" }),
      })
    );
  });

  it("rejects expired pairing codes", async () => {
    const prisma = mockPrisma();
    const generated = generatePairingCode();
    prisma.devicePairing.findUnique.mockResolvedValue({
      id: "pair_1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      projectId: "proj_1",
    });
    const svc = new DevicesService(prisma as unknown as ConstructorParameters<typeof DevicesService>[0]);
    await expect(
      svc.pairWithCode({ code: generated.raw, name: "Pixel" })
    ).rejects.toMatchObject({ code: "pairing_expired", statusCode: 410 } satisfies Partial<AppError>);
  });

  it("pairs with a valid code and burns it", async () => {
    const prisma = mockPrisma();
    const generated = generatePairingCode();
    const pairing = {
      id: "pair_1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      projectId: "proj_1",
      codeHash: hashToken(normalizePairingCode(generated.raw)),
    };
    prisma.devicePairing.findUnique.mockResolvedValue(pairing);
    prisma.$transaction.mockImplementation(async (fn: (tx: PrismaMock) => unknown) => {
      const tx = mockPrisma();
      tx.devicePairing.updateMany.mockResolvedValue({ count: 1 });
      tx.device.create.mockResolvedValue({
        id: "dev_9",
        name: "Pixel",
        status: "PENDING",
        config: {},
      });
      tx.devicePairing.update.mockResolvedValue({});
      return fn(tx);
    });

    const svc = new DevicesService(prisma as unknown as ConstructorParameters<typeof DevicesService>[0]);
    const result = await svc.pairWithCode({ code: generated.raw, name: "Pixel" });
    expect(result.id).toBe("dev_9");
    expect(result.status).toBe("PENDING");
    expect(result.deviceToken).toMatch(/^dev_/);
  });

  it("claims queued outbox rows so they are not sent twice", async () => {
    const prisma = mockPrisma();
    const row = { id: "ob_1", deviceId: "dev_1", toNumber: "+1555", body: "hi", status: "QUEUED" };
    prisma.deviceOutbox.findMany.mockResolvedValue([row]);
    const svc = new DevicesService(prisma as unknown as ConstructorParameters<typeof DevicesService>[0]);
    const result = await svc.pullOutbox("dev_1");
    expect(result.data).toEqual([row]);
    expect(prisma.deviceOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "QUEUED" }),
        data: { status: "SENDING" },
      })
    );
  });
});
