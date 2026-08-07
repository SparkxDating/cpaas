import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { Public } from "../../common/decorators/public.decorator";
import { AuthService } from "./auth.service";

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  organizationName?: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

class PasswordResetRequestDto {
  @IsEmail()
  email!: string;
}

class PasswordResetDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(10)
  password!: string;
}

class VerifyEmailDto {
  @IsString()
  token!: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Public()
  @Post("login")
  login(@Body() body: LoginDto, @Req() req: { headers: Record<string, string>; ip?: string }) {
    return this.auth.login(body.email, body.password, {
      ua: req.headers["user-agent"],
      ip: req.ip,
    });
  }

  @Public()
  @Post("refresh")
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post("logout")
  logout(@Body() body: RefreshDto) {
    return this.auth.logout(body.refreshToken);
  }

  @Public()
  @Post("password/forgot")
  forgot(@Body() body: PasswordResetRequestDto) {
    return this.auth.requestPasswordReset(body.email);
  }

  @Public()
  @Post("password/reset")
  reset(@Body() body: PasswordResetDto) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @Public()
  @Post("email/verify")
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.auth.verifyEmail(body.token);
  }
}
