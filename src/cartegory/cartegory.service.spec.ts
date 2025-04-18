import { Test, TestingModule } from '@nestjs/testing';
import { CartegoryService } from './cartegory.service';

describe('CartegoryService', () => {
  let service: CartegoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CartegoryService],
    }).compile();

    service = module.get<CartegoryService>(CartegoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
