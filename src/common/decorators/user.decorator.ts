/* eslint-disable prettier/prettier */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Convert MongoDB _id to userId for consistency
    return {
      ...user,
      userId: user._id?.toString?.(), // Convert ObjectId to string
    };
  },
);
