/* eslint-disable prettier/prettier */
import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { FilterReviewDto } from './dto/filter-review.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { TokenBlacklistGuard } from '../common/guards/token-blacklist.guard';
import { User } from '../common/decorators/user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'Create a new review (Buyer)' })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully.',
    schema: {
      example: {
        message: 'Review created successfully',
        review: {
          _id: '6632c998fffa43a60d51b235',
          userId: '6632c123fffa43a60d51b111',
          productId: '6632c555fffa43a60d51b555',
          content: 'This product is amazing!',
          rating: 5,
          createdAt: '2024-04-25T12:34:56.789Z',
        },
      },
    },
  })
  async create(
    @Body() createReviewDto: CreateReviewDto,
    @User() user: { userId: string },
  ) {
    return this.reviewsService.create(user.userId, createReviewDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, TokenBlacklistGuard)
  @ApiOperation({ summary: 'List reviews (Admins and Buyers)' })
  @ApiResponse({
    status: 200,
    description: 'List of reviews fetched successfully.',
    schema: {
      example: {
        total: 2,
        page: 1,
        limit: 10,
        reviews: [
          {
            _id: '6632c998fffa43a60d51b235',
            userId: '6632c123fffa43a60d51b111',
            productId: '6632c555fffa43a60d51b555',
            content: 'This product is amazing!',
            rating: 5,
            createdAt: '2024-04-25T12:34:56.789Z',
          },
          {
            _id: '6632c999fffa43a60d51b236',
            userId: '6632c124fffa43a60d51b112',
            productId: '6632c556fffa43a60d51b556',
            content: 'Could be better.',
            rating: 3,
            createdAt: '2024-04-26T09:15:30.000Z',
          },
        ],
      },
    },
  })
  async findAll(
    @Query() filter: FilterReviewDto,
  ) {
    return this.reviewsService.findAll(filter);
  }
}
