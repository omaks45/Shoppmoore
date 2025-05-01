/* eslint-disable prettier/prettier */
export class UserInfoDto {
    firstName: string;
    lastName: string;
    email: string;
  }
  
  export class ProfileResponseDto {
    user: UserInfoDto;
    profileImageUrl: string;
    createdAt: Date;
    updatedAt: Date;
  }
  