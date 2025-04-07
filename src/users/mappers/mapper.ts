/* eslint-disable prettier/prettier */
export const mapUser = (user: any) => ({
    id: user._id,
    fullName: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  });
  