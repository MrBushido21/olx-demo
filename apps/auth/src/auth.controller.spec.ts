import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            registerLink: jest.fn(),
            register: jest.fn(),
            login: jest.fn(),
          },
        },
      ],
    }).compile();

    authController = app.get<AuthController>(AuthController);
    authService = app.get<AuthService>(AuthService);
  });

  // ==================== registerLink ====================
  describe('registerLink', () => {

    it('должен вернуть ссылку при новом емейле', async () => {
      jest.spyOn(authService, 'registerLink').mockResolvedValue('http://localhost/auth/register?token=abc')

      const result = await authController.registerLink({ email: 'new@mail.com' })

      expect(result).toBe('http://localhost/auth/register?token=abc')
      expect(authService.registerLink).toHaveBeenCalledWith('new@mail.com')
    })

    it('должен бросить ConflictException если емейл уже занят', async () => {
      jest.spyOn(authService, 'registerLink').mockRejectedValue(
        new ConflictException('Пользователь с таким емейлом уже существует')
      )

      await expect(
        authController.registerLink({ email: 'existing@mail.com' })
      ).rejects.toThrow(ConflictException)
    })

  })

  // ==================== register ====================
  describe('register', () => {

    it('должен вернуть access_token и установить cookie', async () => {
      const mockTokens = { access_token: 'access123', refresh_token: 'refresh123' }
      jest.spyOn(authService, 'register').mockResolvedValue(mockTokens)

      const mockRes = {
        cookie: jest.fn(),
        json: jest.fn(),
      } as any

      await authController.register(
        { token: 'valid-token', username: 'Oleg', password: '123456' },
        mockRes
      )

      expect(mockRes.cookie).toHaveBeenCalledWith('refresh_token', 'refresh123', expect.any(Object))
      expect(mockRes.json).toHaveBeenCalledWith({ access_token: 'access123' })
    })

    it('должен бросить ошибку если токен невалидный', async () => {
      jest.spyOn(authService, 'register').mockRejectedValue(
        new Error('Неверная ссылка')
      )

      const mockRes = { cookie: jest.fn(), json: jest.fn() } as any

      await expect(
        authController.register({ token: 'bad-token', username: 'Oleg', password: '123456' }, mockRes)
      ).rejects.toThrow('Неверная ссылка')
    })

  })

  // ==================== login ====================
  describe('login', () => {

    it('должен вернуть access_token и установить cookie', async () => {
      const mockTokens = { access_token: 'access123', refresh_token: 'refresh123' }
      jest.spyOn(authService, 'login').mockResolvedValue(mockTokens)

      const mockRes = {
        cookie: jest.fn(),
        json: jest.fn(),
      } as any

      await authController.login({ email: 'user@mail.com', password: '123456' }, mockRes)

      expect(mockRes.cookie).toHaveBeenCalledWith('refresh_token', 'refresh123', expect.any(Object))
      expect(mockRes.json).toHaveBeenCalledWith({ access_token: 'access123' })
    })

    it('должен бросить UnauthorizedException если пароль неверный', async () => {
      jest.spyOn(authService, 'login').mockRejectedValue(
        new UnauthorizedException('Неправильный логин или пароль')
      )

      const mockRes = { cookie: jest.fn(), json: jest.fn() } as any

      await expect(
        authController.login({ email: 'user@mail.com', password: 'wrongpass' }, mockRes)
      ).rejects.toThrow(UnauthorizedException)
    })

  })

})
