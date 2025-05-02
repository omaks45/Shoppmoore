/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Patch,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { FilterReviewDto } from './dto/filter-review.dto';
import { TokenBlacklistGuard } from '../common/guards/token-blacklist.guard';
import { User } from '../common/decorators/user.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'), TokenBlacklistGuard)
@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
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
        ],
      },
    },
  })
  async findAll(@Query() filter: FilterReviewDto) {
    return this.reviewsService.findAll(filter);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a review (Buyer only)' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({
    status: 200,
    description: 'Review updated successfully.',
    schema: {
      example: {
        id: '6632c998fffa43a60d51b235',
        userId: '6632c123fffa43a60d51b111',
        productId: '6632c555fffa43a60d51b555',
        content: 'Updated review content',
        rating: 4,
        reviewType: 'text',
        createdAt: '2024-04-25T12:34:56.789Z',
        updatedAt: '2024-04-26T12:00:00.000Z',
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateReviewDto>,
    @User() user: { userId: string },
  ) {
    return this.reviewsService.update(id, user.userId, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a review (Buyer only)' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({
    status: 200,
    description: 'Review deleted successfully.',
    schema: {
      example: {
        message: 'Review deleted successfully',
      },
    },
  })
  async delete(
    @Param('id') id: string,
    @User() user: { userId: string },
  ) {
    return this.reviewsService.delete(id, user.userId);
  }
}
