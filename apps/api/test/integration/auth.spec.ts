import { AuthController } from '../../src/modules/auth/auth.controller';
import type { AuthService } from '../../src/modules/auth/services/auth.service';
import type { RequestWithUser } from '../../src/modules/auth/guards/jwt-auth.guard';

describe('AuthController (integration)', () => {
  let controller: AuthController;
  let mockService: Record<string, jest.Mock>;

  const request = {
    headers: {
      'user-agent': 'Jest Browser',
      'x-forwarded-for': '203.0.113.10, 10.0.0.1',
    },
    ip: '127.0.0.1',
  };

  beforeEach(() => {
    mockService = {
      requestEmailCode: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      getCurrentUser: jest.fn(),
    };
    controller = new AuthController(mockService as unknown as AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('requests an email code with client IP and user agent', async () => {
    mockService.requestEmailCode!.mockResolvedValue({ cooldownSeconds: 60 });

    const result = await controller.requestCode(
      { email: 'sara@example.com' },
      request,
    );

    expect(result.success).toBe(true);
    expect(result.data.cooldownSeconds).toBe(60);
    expect(mockService.requestEmailCode).toHaveBeenCalledWith(
      'sara@example.com',
      '203.0.113.10',
      'Jest Browser',
    );
  });

  it('logs in with email code and returns token envelope', async () => {
    mockService.login!.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 1800,
      user: {
        id: 'user_1',
        email: 'sara@example.com',
        displayName: 'Sara',
        avatarUrl: null,
      },
    });

    const result = await controller.login(
      { email: 'sara@example.com', code: '123456' },
      request,
    );

    expect(result.success).toBe(true);
    expect(result.data.accessToken).toBe('access-token');
    expect(result.data.user?.id).toBe('user_1');
    expect(mockService.login).toHaveBeenCalledWith(
      'sara@example.com',
      '123456',
      '203.0.113.10',
      'Jest Browser',
    );
  });

  it('refreshes an access token', async () => {
    mockService.refresh!.mockResolvedValue({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
      expiresIn: 1800,
    });

    const result = await controller.refresh({ refreshToken: 'old-refresh' });

    expect(result.success).toBe(true);
    expect(result.data.refreshToken).toBe('next-refresh');
    expect(mockService.refresh).toHaveBeenCalledWith('old-refresh');
  });

  it('logs out idempotently through the service', async () => {
    mockService.logout!.mockResolvedValue({ loggedOut: true });

    const result = await controller.logout({ refreshToken: 'refresh-token' });

    expect(result.success).toBe(true);
    expect(result.data.loggedOut).toBe(true);
    expect(mockService.logout).toHaveBeenCalledWith('refresh-token');
  });

  it('returns the current authenticated user profile', async () => {
    const authRequest: RequestWithUser = {
      headers: { authorization: 'Bearer access-token' },
      user: { id: 'user_1', email: 'sara@example.com', sessionId: 'ses_1' },
    };
    mockService.getCurrentUser!.mockResolvedValue({
      id: 'user_1',
      email: 'sara@example.com',
      displayName: 'Sara',
      avatarUrl: null,
    });

    const result = await controller.me(authRequest);

    expect(result.success).toBe(true);
    expect(result.data.email).toBe('sara@example.com');
    expect(mockService.getCurrentUser).toHaveBeenCalledWith('user_1');
  });
});
