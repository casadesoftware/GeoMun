import { Controller, Post, Get, Body, Param, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@CurrentUser('id') userId: string) {
    return this.authService.profile(userId);
  }

  @Post('register')
  register(@Body() body: { orgName: string; email: string; name: string; password: string }) {
    return this.authService.register(body.orgName, body.email, body.name, body.password);
  }

  @Get('verify/:token')
  async verify(@Param('token') token: string, @Res() res: Response) {
    const result = await this.authService.verifyEmail(token);
    const baseUrl = process.env.APP_URL || 'https://pixelmapas.online';
    if (result.success) {
      res.redirect(`${baseUrl}/?verified=true`);
    } else {
      res.redirect(`${baseUrl}/?verified=false&reason=${result.reason}`);
    }
  }
  
}
