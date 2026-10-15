import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('connects the Prisma client during module initialization', async () => {
    const connect = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects the Prisma client during module destruction', async () => {
    const disconnect = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('checks the database connection with a literal SELECT 1 query', async () => {
    const queryRaw = jest
      .spyOn(service, '$queryRaw')
      .mockResolvedValue([{ result: 1 }]) as jest.Mock;

    await expect(service.checkConnection()).resolves.toBeUndefined();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const [query, ...values] = queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect([...query]).toEqual(['SELECT 1']);
    expect(values).toEqual([]);
  });

  it('propagates database query failures from the connection check', async () => {
    const error = new Error('database unavailable');
    jest.spyOn(service, '$queryRaw').mockRejectedValue(error);

    await expect(service.checkConnection()).rejects.toBe(error);
  });
});
