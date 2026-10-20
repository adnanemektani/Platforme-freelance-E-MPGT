import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  acceptInvitationSchema,
  changePasswordSchema,
  emailOnlySchema,
  loginSchema,
  registerCompanySchema,
  registerFreelancerSchema,
  resetPasswordSchema,
  tokenSchema,
  updateMeSchema,
  type AcceptInvitationInput,
  type ChangePasswordInput,
  type EmailOnlyInput,
  type LoginInput,
  type RegisterCompanyInput,
  type RegisterFreelancerInput,
  type ResetPasswordInput,
  type TokenInput,
  type UpdateMeInput,
} from '@empgt/contracts';
import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import type { Actor } from './actor.js';
import { AuthService } from './auth.service.js';
import { CurrentActor, OptionalActor, Public } from './decorators.js';

const strict = { default: { limit: () => env().THROTTLE_AUTH_PER_MINUTE, ttl: 60_000 } };

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('csrf')
  @ApiOperation({ summary: 'Obtenir le jeton CSRF (à renvoyer dans l’en-tête X-CSRF-Token)' })
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return { csrfToken: this.auth.csrf(req, res) };
  }

  @Public()
  @Throttle(strict)
  @Post('register/company')
  @ApiOperation({ summary: 'Inscription « Je suis une entreprise »' })
  registerCompany(@Body({ schema: registerCompanySchema }) body: RegisterCompanyInput) {
    return this.auth.registerCompany(body);
  }

  @Public()
  @Throttle(strict)
  @Post('register/freelancer')
  @ApiOperation({ summary: 'Inscription « Je suis freelance »' })
  registerFreelancer(@Body({ schema: registerFreelancerSchema }) body: RegisterFreelancerInput) {
    return this.auth.registerFreelancer(body);
  }

  @Public()
  @Throttle(strict)
  @Post('verify-email')
  @HttpCode(200)
  verifyEmail(@Body({ schema: tokenSchema }) body: TokenInput) {
    return this.auth.verifyEmail(body.token);
  }

  @Public()
  @Throttle(strict)
  @Post('resend-verification')
  @HttpCode(200)
  resendVerification(@Body({ schema: emailOnlySchema }) body: EmailOnlyInput) {
    return this.auth.resendVerification(body.email);
  }

  @Public()
  @Throttle(strict)
  @Post('login')
  @HttpCode(200)
  login(@Body({ schema: loginSchema }) body: LoginInput, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(body, req, res);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@CurrentActor() actor: Actor, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(actor, res);
  }

  @Get('me')
  @ApiOperation({ summary: 'Utilisateur courant, rôles, organisation, profil et jeton CSRF' })
  me(@CurrentActor() actor: Actor, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.me(actor, req, res);
  }

  @Patch('me')
  updateMe(@CurrentActor() actor: Actor, @Body({ schema: updateMeSchema }) body: UpdateMeInput) {
    return this.auth.updateMe(actor, body);
  }

  @Public()
  @Throttle(strict)
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body({ schema: emailOnlySchema }) body: EmailOnlyInput) {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Throttle(strict)
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body({ schema: resetPasswordSchema }) body: ResetPasswordInput) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @Throttle(strict)
  @Post('change-password')
  @HttpCode(200)
  changePassword(@CurrentActor() actor: Actor, @Body({ schema: changePasswordSchema }) body: ChangePasswordInput) {
    return this.auth.changePassword(actor, body);
  }

  @Get('sessions')
  sessions(@CurrentActor() actor: Actor) {
    return this.auth.listSessions(actor);
  }

  @Delete('sessions/:id')
  revokeSession(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.auth.revokeSession(actor, id);
  }

  @Public()
  @Throttle(strict)
  @Post('invitations/preview')
  @HttpCode(200)
  previewInvitation(@Body({ schema: tokenSchema }) body: TokenInput) {
    return this.auth.previewInvitation(body.token);
  }

  @Public()
  @Throttle(strict)
  @Post('invitations/accept')
  @HttpCode(200)
  acceptInvitation(
    @Body({ schema: acceptInvitationSchema }) body: AcceptInvitationInput,
    @OptionalActor() actor: Actor | null,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.acceptInvitation(body, actor, req, res);
  }
}
