import { Test, TestingModule } from '@nestjs/testing';
import { CartegoryController } from './cartegory.controller';
import { CartegoryService } from './cartegory.service';

describe('CartegoryController', () => {
  let controller: CartegoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartegoryController],
      providers: [CartegoryService],
    }).compile();

    controller = module.get<CartegoryController>(CartegoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
