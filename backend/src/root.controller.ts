import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  @Redirect('/api', 302)
  root() {
    // Redirects to /api (Swagger UI)
  }
}

