import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfileController } from './controllers/profile.controller';
import { ProfileService } from './services/profile.service';

@Module({
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
