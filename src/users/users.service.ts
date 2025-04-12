/* eslint-disable prettier/prettier */
// user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument, User } from '../auth/auth.schema';
import { NotificationService } from '../notifications/notifications.service';
import { FilterUserDto } from '../users/dto/filter-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  private toEntity(doc: any): UserEntity {
    const { _id, firstName, lastName, email, phoneNumber, role, isVerified, address, createdAt } = doc;
    return { id: _id.toString(), firstName, lastName, email, phoneNumber, role, isVerified, address, createdAt };
  }

  async findAll(filter: FilterUserDto): Promise<UserEntity[]> {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 10;
    const skip = (page - 1) * limit;

    const docs = await this.userModel.find().skip(skip).limit(limit).lean();
    return docs.map(d => this.toEntity(d));
  }

  async findById(id: string): Promise<UserEntity> {
    const doc = await this.userModel.findById(id).lean();
    if (!doc) throw new NotFoundException('User not found');
    return this.toEntity(doc);
  }

  // NEW: Return the actual Mongoose document (not .lean())
  async findRawById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const doc = await this.userModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!doc) throw new NotFoundException('User not found');
    await this.notificationService.sendNotification({
      message: `Your profile was updated`,
      userId: id,
    });
    return this.toEntity(doc);
  }

  async remove(id: string): Promise<void> {
    const doc = await this.userModel.findByIdAndDelete(id).lean();
    if (!doc) throw new NotFoundException('User not found');
    await this.notificationService.sendNotification({
      message: `User with ID ${id} has been deleted.`,
      userId: id,
    });
  }
}
