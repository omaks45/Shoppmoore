/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Review, ReviewDocument } from './review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { FilterReviewDto } from './dto/filter-review.dto';
import { ReviewEntity } from './review.entity/review.entity';
import { NotificationService } from '../notifications/notifications.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  async create(userId: string, dto: CreateReviewDto): Promise<ReviewEntity> {
    const created = await this.reviewModel.create({
      ...dto,
      userId,
    });

    // Notify admin through websocket + firebase
    await this.notificationService.notifyNewReview(created);

    return this.toEntity(created);
  }

  async findAll(filter: FilterReviewDto): Promise<{
    data: ReviewEntity[];
    metadata: { totalItems: number; totalPages: number; currentPage: number; pageSize: number };
  }> {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filter.productId) query.productId = filter.productId;
    if (filter.userId) query.userId = filter.userId;
    if (filter.reviewType) query.reviewType = filter.reviewType;

    const totalItems = await this.reviewModel.countDocuments(query);
    const docs = await this.reviewModel.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }).lean();

    return {
      data: docs.map(d => this.toEntity(d)),
      metadata: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        pageSize: limit,
      },
    };
  }

  private toEntity(doc: any): ReviewEntity {
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      productId: doc.productId,
      content: doc.content,
      rating: doc.rating,
      reviewType: doc.reviewType,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
