/* eslint-disable prettier/prettier */
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/// This decorator extracts the user from the request object
export const User = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    console.log('User object from request:', request.user);

    return data ? user?.[data] : user;
  },
);
