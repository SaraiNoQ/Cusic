import { HttpException, HttpStatus } from '@nestjs/common';

export function authError(status: HttpStatus, code: string, message: string) {
  return new HttpException(
    {
      success: false,
      error: {
        code,
        message,
      },
      meta: {},
    },
    status,
  );
}
