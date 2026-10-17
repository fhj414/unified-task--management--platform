export const MOCK_DEPARTMENTS = [
  { id: '2d2e2c8a-f9bd-4d96-99bf-69cfb4950031', name: 'Engineering' },
  { id: '601dc8c4-2479-4af0-a32a-4b8f71b3d5d4', name: 'Operations' },
] as const;

export const MOCK_IDENTITIES = [
  {
    email: 'ada.lovelace@enterprise-hub.local',
    name: 'Ada Lovelace',
    departmentId: MOCK_DEPARTMENTS[0].id,
  },
  {
    email: 'grace.hopper@enterprise-hub.local',
    name: 'Grace Hopper',
    departmentId: MOCK_DEPARTMENTS[1].id,
  },
  {
    email: 'linus.torvalds@enterprise-hub.local',
    name: 'Linus Torvalds',
    departmentId: MOCK_DEPARTMENTS[0].id,
  },
] as const;

export const MOCK_IDENTITY_EMAILS = MOCK_IDENTITIES.map(
  ({ email }) => email,
);

const mockIdentityEmailSet: ReadonlySet<string> = new Set(MOCK_IDENTITY_EMAILS);

export function isMockIdentityEmail(email: string): boolean {
  return mockIdentityEmailSet.has(email);
}
