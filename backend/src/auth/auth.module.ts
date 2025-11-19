import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

/**
 * Auth Module for system-level JWT authentication
 * No login/register - tokens are pre-configured for services
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
     useFactory: async (configService: ConfigService) => ({
  secret: configService.get<string>('JWT_SECRET') || 'loan-system-secret-key-change-in-production',
  signOptions: {
    expiresIn: Number(configService.get<string>('JWT_EXPIRES_IN')) || 86400, //24 hours
  },
}),

      inject: [ConfigService],
    }),
  ],
  providers: [JwtStrategy],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}

